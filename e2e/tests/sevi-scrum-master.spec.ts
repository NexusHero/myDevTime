import { test, expect, type Page } from '@playwright/test'
import {
  apiSignUp,
  currentWeekMonday,
  freshUser,
  seedOvercommittedWeek,
  uiSignIn,
} from './support/fixtures.js'

/**
 * Acceptance for Sevi as Scrum-Master at planning time (REQ-070, ADR-0071), driven through
 * the built web app like the golden-path specs (ADR-0053). The week's load is seeded through
 * the REAL endpoints the advisory consumes (recurrence series → occurrences), so every figure
 * on screen is the deterministic core's over persisted data: an over-committed week surfaces
 * ONE banner carrying the overage figure; a fitting week shows nothing; a confirmed relief
 * routes a protect-time proposal through the plan-apply seam and SURVIVES a full reload
 * (the 🛡 window persists, the displaced load drops the figure); a dismissed banner changes
 * nothing at all.
 *
 * Seeded arithmetic (see `seedOvercommittedWeek`): 40 h target − 10 h life = 30 h plannable,
 * 50 h focus planned → "+20.0 h". Confirming relief on Monday's 10 h "Deep work" slot books
 * a protect-time window over it; its displaced load leaves 40 h planned → "+10.0 h".
 */

/** The banner title always carries the week figures — the one stable advisory probe. */
const OVER_FIGURE = /Only 30\.0 h plannable, 50\.0 h planned — \+20\.0 h/
const RELIEVED_FIGURE = /Only 30\.0 h plannable, 40\.0 h planned — \+10\.0 h/
const ANY_ADVISORY = /h plannable, .* h planned — \+/

/** Open the Planner's Week stage, where the advisory mounts. */
async function gotoPlannerWeek(page: Page): Promise<void> {
  await page.goto('/planner')
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  // The capacity head-trace is the Week stage's ready signal.
  await expect(page.getByText('Plannable this week')).toBeVisible()
}

/** Sign up a fresh user through the API, sign in through the real UI. */
async function signIn(page: Page, request: Parameters<typeof apiSignUp>[0]): Promise<void> {
  const user = freshUser('sevi')
  await apiSignUp(request, user)
  await uiSignIn(page, user)
}

test.describe('acceptance · sevi scrum-master (REQ-070)', () => {
  test('over-committed week → the advisory shows with the overage figure', async ({
    page,
    request,
  }) => {
    await signIn(page, request)
    await seedOvercommittedWeek(page.request, currentWeekMonday())
    await gotoPlannerWeek(page)

    // The one calm banner, its accessible title carrying the exact deterministic figures.
    await expect(page.getByText(OVER_FIGURE)).toBeVisible()
    // Relief is offered as proposals — present, but nothing has been applied.
    await expect(page.getByRole('button', { name: 'Protect "Deep work"' }).first()).toBeVisible()
  })

  test('fitting week → no advisory at all (no nag)', async ({ page, request }) => {
    await signIn(page, request)
    await seedOvercommittedWeek(page.request, currentWeekMonday(), { light: true })
    await gotoPlannerWeek(page)

    // The seeded light load reached the canvas … (occurrences render as ↻ ghosts)
    await expect(page.getByText(/Light work/).first()).toBeVisible()
    // … and the advisory stays entirely absent for a week that fits.
    await expect(page.getByText(ANY_ADVISORY)).toHaveCount(0)
  })

  test('confirmed relief persists across reload and drops the overage figure', async ({
    page,
    request,
  }) => {
    await signIn(page, request)
    const monday = currentWeekMonday()
    await seedOvercommittedWeek(page.request, monday)
    await gotoPlannerWeek(page)
    await expect(page.getByText(OVER_FIGURE)).toBeVisible()

    await test.step('pick a relief candidate, then explicitly confirm', async () => {
      await page.getByRole('button', { name: 'Protect "Deep work"' }).first().click()
      await page.getByRole('button', { name: 'Confirm', exact: true }).click()
      // The existing toast acknowledges the applied change.
      await expect(page.getByText(/Applied — /)).toBeVisible()
    })

    await test.step('the concrete effect of the mapping: a persisted 🛡 window', async () => {
      // Confirming Monday's "Deep work" relief books protect-time over exactly its slot
      // (09:00–19:00) — durable server state, not client memory.
      const res = await page.request.get(`/api/planner/protected?day=${monday}`)
      expect(res.ok()).toBeTruthy()
      const windows = (await res.json()) as { startMin: number; endMin: number }[]
      expect(windows).toHaveLength(1)
      expect(windows[0]).toMatchObject({ startMin: 9 * 60, endMin: 19 * 60 })
    })

    await test.step('after a full reload the figure has dropped', async () => {
      await page.reload()
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      // Monday's displaced 10 h leave the load: 50 h → 40 h planned, +20 h → +10 h.
      await expect(page.getByText(RELIEVED_FIGURE)).toBeVisible()
      await expect(page.getByText(OVER_FIGURE)).toHaveCount(0)
    })
  })

  test('open + dismiss without confirm → reload unchanged', async ({ page, request }) => {
    await signIn(page, request)
    const monday = currentWeekMonday()
    await seedOvercommittedWeek(page.request, monday)
    await gotoPlannerWeek(page)
    await expect(page.getByText(OVER_FIGURE)).toBeVisible()

    await test.step('arm a candidate, cancel, then dismiss — never confirming', async () => {
      await page.getByRole('button', { name: 'Protect "Deep work"' }).first().click()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Later', exact: true }).click()
      await expect(page.getByText(ANY_ADVISORY)).toHaveCount(0)
    })

    await test.step('nothing was persisted: no 🛡 window, same figure after reload', async () => {
      const res = await page.request.get(`/api/planner/protected?day=${monday}`)
      expect(res.ok()).toBeTruthy()
      expect((await res.json()) as unknown[]).toHaveLength(0)

      await page.reload()
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await expect(page.getByText(OVER_FIGURE)).toBeVisible()
    })
  })
})
