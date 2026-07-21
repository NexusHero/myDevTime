import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import {
  apiSignUp,
  enableSevi,
  freshUser,
  readPlanToday,
  seedAcceptedPlanToday,
  uiSignIn,
  utcMinuteNow,
} from './support/fixtures.js'

/**
 * One-tap day repair (REQ-072, ADR-0072 D1, browser per ADR-0053). The specs seed a REAL
 * accepted plan through the plan-apply seam, break it (a missed block in the past), and drive
 * the drift chip → ghost preview → one tap. Everything asserted is persisted state read back
 * through the same API the app uses — the repair happy path is proven reload-stable, dismiss
 * is proven a byte-identical no-op, and the stretch path shows its price BEFORE the tap and
 * leaves Sevi's own-baseline voice quiet after a conscious accept.
 *
 * Seeds are laid relative to the current UTC minute (the runner is pinned to UTC), with the
 * broken block 2 h in the past and the remainder within the next ~3 h — the same "keep it in
 * the (short) past/future" constraint the worktime persona seeds already live with.
 */

/** Minutes-from-UTC-midnight → `HH:MM` (the app's Co-Planner time-label convention). */
function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}`
}

/** The drift chip in its action form (Today's adherence chip + the Day view's own chip). */
function repairChip(page: Page): ReturnType<Page['getByRole']> {
  return page.getByRole('button', { name: 'Plan gerissen · Reparieren' }).first()
}

/**
 * Seed the broken-but-repairable day: one 60-min focus block missed 2 h ago, the remaining
 * two blocks ahead with gaps — the reflow pulls the missed hour into the present and cascades.
 */
async function seedBrokenDay(request: APIRequestContext, now: number): Promise<void> {
  await seedAcceptedPlanToday(request, [
    { startMin: now - 120, lenMin: 60, kind: 'focus', label: 'Deep work' },
    { startMin: now + 30, lenMin: 60, kind: 'focus', label: 'Docs' },
    { startMin: now + 120, lenMin: 60, kind: 'focus', label: 'Review' },
  ])
}

test.describe('acceptance · one-tap day repair (REQ-072)', () => {
  test('a broken day is repaired with one tap through the plan-apply seam — reload-stable', async ({
    page,
    request,
  }) => {
    const user = freshUser('repair')
    await apiSignUp(request, user)
    const now = utcMinuteNow()
    await seedBrokenDay(request, now)
    await uiSignIn(page, user)

    await test.step('the drift chip is the action: Reparieren on the adherence chip', async () => {
      await expect(repairChip(page)).toBeVisible()
      // The chip is the HANDLE — nothing has moved yet.
      const before = await readPlanToday(request)
      expect(before?.version).toBe(1)
    })

    await test.step('tapping the chip opens the ghost preview', async () => {
      await repairChip(page).click()
      await expect(page.getByText('Repair the rest of the day')).toBeVisible()
      await expect(page.getByText('nothing moves without your tap')).toBeVisible()
      // The missed block appears as a ghost placement in the preview.
      await expect(page.getByText('Deep work').first()).toBeVisible()
    })

    let repairedTimeLabel = ''
    await test.step('one tap applies a NEW accepted version with the re-laid remainder', async () => {
      const before = await readPlanToday(request)
      await page.getByRole('button', { name: 'Confirm repair' }).click()
      await expect(page.getByText('Repair the rest of the day')).toBeHidden()

      await expect
        .poll(async () => (await readPlanToday(request))?.version, {
          message: 'the seam writes a new plan version',
        })
        .toBe((before?.version ?? 0) + 1)
      const after = await readPlanToday(request)
      expect(after?.status).toBe('accepted')
      expect(after?.blocks).toHaveLength(3)
      const repaired = after?.blocks.find(b => b.label === 'Deep work')
      expect(repaired).toBeDefined()
      // The missed hour moved out of the past into the present, full length kept.
      expect(repaired!.startMin).toBeGreaterThanOrEqual(now - 2)
      expect(repaired!.lenMin).toBe(60)
      repairedTimeLabel = `${hhmm(repaired!.startMin)}–${hhmm(repaired!.startMin + 60)}`
      // __DIAG__ one-shot: what is actually on the Today screen after the repair confirm?
      await page.waitForTimeout(2000)
      const url = page.url()
      const bodyText = (await page.locator('body').innerText().catch(() => '<<no body>>')).slice(
        0,
        2500,
      )
      const hasCoPlanner = await page.getByText('Co-Planner').count()
      const hasChip = await page
        .getByRole('button', { name: 'Plan gerissen · Reparieren' })
        .count()
      // eslint-disable-next-line no-console
      console.log(
        `__DIAG2__ ${JSON.stringify({ expected: repairedTimeLabel, url, hasCoPlanner, hasChip, bodyText })}`,
      )
      // The Co-Planner card re-reads the new version and shows the repaired time.
      await expect(page.getByText(repairedTimeLabel).first()).toBeVisible()
    })

    await test.step('the repair is reload-stable — persisted, not client state', async () => {
      const beforeReload = await readPlanToday(request)
      await page.reload()
      await expect(page.getByText(repairedTimeLabel).first()).toBeVisible()
      const afterReload = await readPlanToday(request)
      expect(JSON.stringify(afterReload)).toBe(JSON.stringify(beforeReload))
    })
  })

  test('dismissing the preview changes nothing — the plan stays byte-identical', async ({
    page,
    request,
  }) => {
    const user = freshUser('repair-noop')
    await apiSignUp(request, user)
    await seedBrokenDay(request, utcMinuteNow())
    await uiSignIn(page, user)

    // The planner Day view carries the same chip (the sheet's built-in handle).
    await page.goto('/planner')
    await expect(repairChip(page)).toBeVisible()
    const before = await readPlanToday(request)

    await repairChip(page).click()
    await expect(page.getByText('Repair the rest of the day')).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss repair' }).click()
    await expect(page.getByText('Repair the rest of the day')).toBeHidden()

    // Nothing moved: same version, same bytes; the chip still offers the repair.
    const after = await readPlanToday(request)
    expect(JSON.stringify(after)).toBe(JSON.stringify(before))
    await expect(repairChip(page)).toBeVisible()
  })

  test('stretch: the price is visible BEFORE the tap; own-baseline Sevi stays quiet after accepting', async ({
    page,
    request,
  }) => {
    const user = freshUser('repair-stretch')
    await apiSignUp(request, user)
    // Proactive Sevi ON with no quiet window — a nudge COULD speak if the policy allowed it.
    await enableSevi(request)
    const now = utcMinuteNow()
    // The remainder only fits past the plan's own end (the capacity line): the missed hour
    // finds no gap — an in-progress 2 h block occupies now..+90 and Wrap-up follows at +90.
    await seedAcceptedPlanToday(request, [
      { startMin: now - 120, lenMin: 60, kind: 'focus', label: 'Overrun task' },
      { startMin: now - 30, lenMin: 120, kind: 'focus', label: 'Current block' },
      { startMin: now + 90, lenMin: 60, kind: 'focus', label: 'Wrap-up' },
    ])
    // Deterministic price, independent of the click minute: the missed hour lands after
    // Wrap-up → +60 min over the line, projected end = planned end + 60.
    const plannedEnd = now + 150
    const price = `+60 min über deiner Linie · Feierabend ~${hhmm(plannedEnd + 60)}`
    await uiSignIn(page, user)

    await test.step('the ghost preview states the deal before any tap', async () => {
      await repairChip(page).click()
      await expect(page.getByText('Repair the rest of the day')).toBeVisible()
      await expect(page.getByText(price)).toBeVisible()
      // Still only the seeded version — showing the price mutated nothing.
      expect((await readPlanToday(request))?.version).toBe(1)
    })

    await test.step('accepting applies the stretch and keeps the own-baseline voice quiet', async () => {
      await page.getByRole('button', { name: 'Confirm repair' }).click()
      await expect(page.getByText('Repair the rest of the day')).toBeHidden()
      await expect
        .poll(async () => (await readPlanToday(request))?.version)
        .toBe(2)

      // The chosen overrun is acknowledged for the day: no own-baseline Sevi voice appears —
      // not now and not after a reload (the acknowledgment is day-scoped client state; the
      // hard-cap tiers are pinned unaffected in the domain + hook unit tests).
      await expect(page.getByRole('status').filter({ hasText: 'Sevi' })).toHaveCount(0)
      await page.reload()
      // The applied stretch layout is the plan now (reload-stable): the missed hour slots in
      // right after the in-progress block, pushing Wrap-up past the old planned end.
      const after = await readPlanToday(request)
      const overrun = after?.blocks.find(b => b.label === 'Overrun task')
      expect(overrun?.startMin).toBe(now + 90)
      const wrapUp = after?.blocks.find(b => b.label === 'Wrap-up')
      expect(wrapUp?.startMin).toBe(plannedEnd)
      // … and Sevi still has nothing to say about the chosen overrun.
      await expect(page.getByText('Wrap-up').first()).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: 'Sevi' })).toHaveCount(0)
    })
  })
})
