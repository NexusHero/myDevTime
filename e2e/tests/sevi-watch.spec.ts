import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import {
  apiSignUp,
  freshUser,
  protectNow,
  seedTodayShift,
  setSeviPrefs,
  uiSignIn,
} from './support/fixtures.js'

/**
 * Acceptance for Sevi's real-time overwork watch (ADR-0071, REQ-067/069), driven
 * through the built web app exactly like the golden paths (ADR-0053): role-based
 * locators only. The watch line is a `role="status"` region whose accessible name
 * carries the reason, so the specs assert the same surface assistive tech reads.
 * Every day is seeded through the REAL worktime endpoint; every gate (opt-in,
 * protection) is exercised through the real preferences / plan-apply seams.
 */

/** Sevi's inline watch line — any of its reason phrasings (English: UTC/en-US runner). */
function watchLine(page: Page) {
  return page.getByRole('status', {
    name: /long day|without a break|heavier than your usual|heavy days/i,
  })
}

/** Sign a fresh user up + in; returns after the auth gate lets the app through. */
async function signIn(page: Page, request: APIRequestContext): Promise<void> {
  const user = freshUser('sevi')
  await apiSignUp(request, user)
  await uiSignIn(page, user)
}

/** Open Today and wait for the Day Canvas to be up. */
async function openToday(page: Page): Promise<void> {
  await page.goto('/today')
  await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible()
}

test.describe('acceptance · sevi overwork watch', () => {
  test('REQ-067 · a hard day (9.7 h worked) surfaces the watch line as a status region', async ({
    page,
    request,
  }) => {
    await signIn(page, request)
    // A completed 9.7 h shift today crosses the ≥ 9.5 h long-day hard cap.
    await seedTodayShift(request, { hoursAgo: 10, hours: 9.7 })
    // Opt in to proactivity and clear the quiet window (start === end ⇒ none), so
    // the spec is deterministic regardless of the wall-clock hour it runs at.
    await setSeviPrefs(request, { seviProactive: true, quietStartMin: 0, quietEndMin: 0 })
    await openToday(page)
    await expect(watchLine(page)).toBeVisible()
  })

  test('REQ-067 · a calm day (2 h with a real break) stays silent', async ({ page, request }) => {
    await signIn(page, request)
    await seedTodayShift(request, { hoursAgo: 3, hours: 2, breakMin: 30 })
    await setSeviPrefs(request, { seviProactive: true, quietStartMin: 0, quietEndMin: 0 })
    await openToday(page)
    await expect(watchLine(page)).toHaveCount(0)
  })

  test('REQ-069 · proactivity off keeps Sevi silent even on a hard day', async ({
    page,
    request,
  }) => {
    await signIn(page, request)
    await seedTodayShift(request, { hoursAgo: 10, hours: 9.7 })
    await setSeviPrefs(request, { seviProactive: false, quietStartMin: 0, quietEndMin: 0 })
    await openToday(page)
    await expect(watchLine(page)).toHaveCount(0)
  })

  test('REQ-069 · an active 🛡 protected block holds the nudge (no watch line)', async ({
    page,
    request,
  }) => {
    await signIn(page, request)
    await seedTodayShift(request, { hoursAgo: 10, hours: 9.7 })
    await setSeviPrefs(request, { seviProactive: true, quietStartMin: 0, quietEndMin: 0 })
    // A protected window covering right now — booked through the real plan-apply seam.
    await protectNow(request)
    await openToday(page)
    await expect(watchLine(page)).toHaveCount(0)
  })
})
