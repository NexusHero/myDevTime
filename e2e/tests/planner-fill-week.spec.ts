import { test, expect, type Page } from '@playwright/test'
import {
  apiSignUp,
  currentWeekDays,
  currentWeekMonday,
  freshUser,
  readLatestPlan,
  seedCatalog,
  seedMeetingHeavyDay,
  seedTicket,
  uiSignIn,
} from './support/fixtures.js'

/**
 * Backlog rail + "Fülle meine Woche" (REQ-073, ADR-0072 D2). The journey: three seeded
 * tickets (one deliberately unestimated → the deterministic 60-min default; one too big for
 * the whole week → the honest unplaced count) plus a meeting-heavy Monday → open the rail
 * (a layer, closed by default) → fill the week → ghosts render, incl. the 60-min default
 * block, nothing booked yet → ONE confirm books everything through the plan-apply seam
 * (provenance `planner-fill`) → the blocks are persisted (`GET /api/planner/plans`),
 * reload-stable, and never overlap the meeting-heavy morning. Negative: Dismiss writes
 * nothing — no plan row exists afterwards.
 *
 * Seeding runs through the STANDALONE `request` fixture (see the cookie-jar rule in
 * fixtures.ts): `apiSignUp` leaves the session cookie there, so seeds write as the user
 * while the page still gets to sign in through the real UI.
 */

/** Open the Planner on the Week stage and unfold the backlog rail layer. */
async function openBacklogRail(page: Page): Promise<void> {
  await page.goto('/planner')
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  const chip = page.getByRole('button', { name: 'Backlog rail' })
  await expect(chip).toBeVisible()
  // The rail is closed by default — its fill action only exists after the tap.
  await expect(page.getByRole('button', { name: 'Fill my week' })).toHaveCount(0)
  await chip.click()
}

test.describe('acceptance · backlog rail + fill week', () => {
  test('REQ-073 · three tickets + a meeting-heavy day fill the week as ghosts; one confirm persists them honestly', async ({
    page,
    request,
  }) => {
    const user = freshUser('fill-week')
    const monday = currentWeekMonday()
    await apiSignUp(request, user)

    await test.step('seed: 3 tickets (one unestimated, one too big) + meetings walling Monday', async () => {
      const catalog = await seedCatalog(request, { task: 'Fix login redirect' })
      // The catalog's own first ticket gets an explicit 2h estimate…
      await seedTicket(request, catalog.projectId, 'Write import docs') // …this one has NONE (60-min default)
      await seedTicket(request, catalog.projectId, 'Quarterly platform rewrite', 4000) // never fits
      const estimate = await request.patch(`/api/tracking/tasks/${catalog.taskId}`, {
        data: { estimateMinutes: 120 },
      })
      expect(estimate.ok()).toBeTruthy()
      await seedMeetingHeavyDay(request, monday)
    })

    await uiSignIn(page, user)
    await openBacklogRail(page)

    await test.step('the rail lists all three tickets, the unestimated one at the visible default', async () => {
      await expect(page.getByLabel('Backlog item: Fix login redirect')).toBeVisible()
      await expect(page.getByLabel('Backlog item: Write import docs')).toBeVisible()
      await expect(page.getByLabel('Backlog item: Quarterly platform rewrite')).toBeVisible()
      await expect(page.getByLabel('Backlog item: Write import docs')).toContainText(
        'default 60 min',
      )
    })

    await test.step('fill the week: ghosts render (incl. the 60-min default block), the remainder is honest', async () => {
      await page.getByRole('button', { name: 'Fill my week' }).click()
      await expect(page.getByText('Proposed week')).toBeVisible()
      // The unestimated ticket lands as exactly one 60-min ghost.
      const defaultGhost = page.getByLabel(/^Ghost: Write import docs/)
      await expect(defaultGhost).toBeVisible()
      await expect(defaultGhost).toContainText('1:00 h')
      // Monday is walled by meetings 08–17: no ghost may start before 17:00 there.
      const mondayLabel = `${monday.slice(8, 10)}.${monday.slice(5, 7)}.`
      for (const ghost of await page.getByLabel(/^Ghost: /).all()) {
        const label = (await ghost.getAttribute('aria-label')) ?? ''
        if (label.includes(mondayLabel)) {
          const time = label.slice(label.lastIndexOf(' ') + 1)
          expect(time >= '17:00', `ghost inside Monday's meetings: ${label}`).toBeTruthy()
        }
      }
      // The over-sized ticket is honestly unplaced — shown, never hidden.
      await expect(page.getByText("1 doesn't fit this week")).toBeVisible()
      // Nothing is booked yet: a proposal alone writes no plan.
      expect(await readLatestPlan(request, monday)).toBeNull()
    })

    await test.step('ONE confirm books every ghost through the seam (provenance planner-fill)', async () => {
      await page.getByRole('button', { name: 'Confirm plan' }).click()
      await expect(page.getByText('Proposed week')).toBeHidden()
      // The persisted read-back shows what actually survived the seam.
      await expect(page.getByLabel('Planned blocks')).toBeVisible()
      await expect(page.getByLabel('Planned blocks')).toContainText('Fix login redirect')
      await expect(page.getByLabel('Planned blocks')).toContainText('Write import docs')
    })

    await test.step('the stored plans hold every placement and respect the meeting wall', async () => {
      const days = currentWeekDays()
      const stored: { day: string; startMin: number; lenMin: number; label: string }[] = []
      for (const day of days) {
        const plan = await readLatestPlan(request, day)
        for (const block of plan?.blocks ?? []) stored.push({ day, ...block })
      }
      // 120 + 60 booked minutes — the 4000-min ticket was never partially smuggled in.
      expect(stored.reduce((sum, b) => sum + b.lenMin, 0)).toBe(180)
      const labels = new Set(stored.map(b => b.label))
      expect(labels.has('Fix login redirect')).toBeTruthy()
      expect(labels.has('Write import docs')).toBeTruthy()
      expect(labels.has('Quarterly platform rewrite')).toBeFalsy()
      // Nothing on Monday starts inside the 08–17 meeting wall.
      for (const block of stored.filter(b => b.day === monday)) {
        expect(block.startMin).toBeGreaterThanOrEqual(17 * 60)
      }
    })

    await test.step('the booked week survives a reload (read back from the stored plans)', async () => {
      await page.reload()
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Backlog rail' }).click()
      await expect(page.getByLabel('Planned blocks')).toBeVisible()
      await expect(page.getByLabel('Planned blocks')).toContainText('Fix login redirect')
    })
  })

  test('REQ-073 · dismissing the ghost week writes nothing', async ({ page, request }) => {
    const user = freshUser('fill-week-dismiss')
    await apiSignUp(request, user)
    const catalog = await seedCatalog(request, { task: 'Never booked ticket' })
    await seedTicket(request, catalog.projectId, 'Second unbooked ticket', 90)

    await uiSignIn(page, user)
    await openBacklogRail(page)

    await test.step('fill, then dismiss — the preview goes, nothing is posted', async () => {
      await page.getByRole('button', { name: 'Fill my week' }).click()
      await expect(page.getByText('Proposed week')).toBeVisible()
      await page.getByRole('button', { name: 'Dismiss' }).click()
      await expect(page.getByText('Proposed week')).toBeHidden()
    })

    await test.step('no plan row exists on any weekday, before or after a reload', async () => {
      for (const day of currentWeekDays()) {
        expect(await readLatestPlan(request, day)).toBeNull()
      }
      await page.reload()
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Backlog rail' }).click()
      // The rail is up (anchor) and there is no persisted read-back to show.
      await expect(page.getByRole('button', { name: 'Fill my week' })).toBeVisible()
      await expect(page.getByLabel('Planned blocks')).toHaveCount(0)
    })
  })
})
