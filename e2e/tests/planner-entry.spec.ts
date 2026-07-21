import { test, expect, type Page } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * Planner manual entry (REQ-060, design v19/v20): the "+ New" dialog collects a
 * Task draft and the Planner persists it as a real single-occurrence recurring
 * series (`POST /api/recurrence`), placed at the next free slot of the shown
 * week. The spec drives the real dialog (labels from `PlannerNewEntryDialog`),
 * then asserts the block on the week canvas — on web that canvas is the
 * FullCalendar timegrid (ADR-0068), which renders each occurrence's title
 * through the app's own event renderer. Persistence is proven by a full page
 * reload: the occurrence is re-projected server-side from the stored series
 * (ADR-0005 — the deterministic core owns the projection). The negative path
 * cancels the dialog and proves nothing was created.
 */

/** Open the Planner's "+ New" dialog and wait for its Title field. */
async function openNewEntryDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New' }).click()
  await expect(page.getByLabel('Title')).toBeVisible()
}

/** Switch the Planner to the Week canvas (the view defaults to Day). */
async function showWeekCanvas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Week', exact: true }).click()
}

test.describe('acceptance · planner manual entry', () => {
  test('REQ-060 · creating a Task in the "+ New" dialog places a persistent block on the week canvas', async ({
    page,
    request,
  }) => {
    const user = freshUser('planner')
    const title = 'Deep work block'
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    await test.step('open the Planner and the New-Entry dialog', async () => {
      await page.goto('/planner')
      await openNewEntryDialog(page)
      // The dialog opens in Task mode (design v20 typed "+ New").
      await expect(page.getByText('New task', { exact: true })).toBeVisible()
    })

    await test.step('fill the Task draft and create it', async () => {
      await page.getByLabel('Title').fill(title)
      // Default effort (1h) and priority (Med) are kept — the dialog invents nothing.
      await page.getByRole('button', { name: 'Create task' }).click()
      // The dialog closes once `createSeries` settles.
      await expect(page.getByLabel('Title')).toBeHidden()
    })

    await test.step('the block renders on the week canvas', async () => {
      // The Planner places the entry at the next free slot — preferring today, else
      // the first free weekday — so the Week canvas (all seven days) is the surface
      // that deterministically shows it regardless of the wall-clock time of day.
      await showWeekCanvas(page)
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    })

    await test.step('the entry survives a reload (persisted as a series via POST /api/recurrence)', async () => {
      await page.reload()
      await showWeekCanvas(page)
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    })
  })

  test('REQ-060 · cancelling the dialog creates nothing', async ({ page, request }) => {
    const user = freshUser('planner-cancel')
    const title = 'Ghost entry never created'
    await apiSignUp(request, user)
    await uiSignIn(page, user)
    await page.goto('/planner')

    await test.step('open the dialog, type a title, then cancel', async () => {
      await openNewEntryDialog(page)
      await page.getByLabel('Title').fill(title)
      // The footer Cancel (the header close carries the same accessible name).
      await page.getByRole('button', { name: 'Cancel' }).last().click()
      await expect(page.getByLabel('Title')).toBeHidden()
    })

    await test.step('after a reload the week canvas holds no such block', async () => {
      await page.reload()
      await showWeekCanvas(page)
      // Anchor on the canvas being up before asserting absence.
      await expect(page.getByRole('button', { name: '+ New' })).toBeVisible()
      await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    })
  })
})
