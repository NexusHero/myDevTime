import { test, expect, type Page } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * E2E golden paths (REQ-022, issue #27): the three journeys a real user takes on
 * every working day — sign up and land in the app, track a slice of time on Today,
 * and read the Reports summary — driven through the built web app in a real
 * browser, exactly like the a11y/persona specs (ADR-0053). Selectors are
 * accessibility-first (roles + accessible names from the app's own
 * `accessibilityLabel`s), so the specs survive styling churn. A fourth check ties
 * to REQ-043: tabbing through Today must land on an element with a *visible*
 * focus outline (the accent focus ring).
 */

/** The Today hero tracker's punch button — labeled `Start` idle, `Stop` while active. */
function punchButton(page: Page, state: 'Start' | 'Stop') {
  return page.getByRole('button', { name: state, exact: true }).first()
}

/** Sign in and land on the Planner Day view (the unified home, ADR-0075). */
async function signInToToday(page: Page, request: Parameters<typeof apiSignUp>[0]): Promise<void> {
  const user = freshUser('golden')
  await apiSignUp(request, user)
  await uiSignIn(page, user)
  await page.goto('/planner')
  await expect(punchButton(page, 'Start')).toBeVisible()
}

test.describe('acceptance · golden paths', () => {
  test('REQ-022 · auth golden path: register via the UI and reach the Planner Day view', async ({
    page,
  }) => {
    const user = freshUser('golden-auth')

    await test.step('register through the real UI', async () => {
      await page.goto('/')
      // Bypass the onboarding flow, same as the shared uiSignIn helper.
      await page.evaluate(() => localStorage.setItem('mydevtime.onboarded', '1'))
      await page.getByRole('button', { name: /create free account/i }).click()
      await page.getByPlaceholder('Suhay Sevinc').fill(user.name)
      await page.getByPlaceholder('you@company.com').fill(user.email)
      await page.getByPlaceholder('At least 8 characters').fill(user.password)
      await page.getByRole('button', { name: /^create free account$/i }).click()
      // Sign-up auto-authenticates in the E2E stack — the whole auth form leaves the DOM once the
      // session is established. Wait on the register form's unique email input rather than the
      // "Create free account" text (which the screen renders twice — heading + submit button — so a
      // getByText() hits two nodes) or the submit button alone (which can hide transiently mid-submit,
      // before auth actually completes, racing the /planner navigation). The email input unmounts only
      // when the authenticated shell replaces the auth screen — a reliable "auth done" signal.
      await expect(page.getByPlaceholder('you@company.com')).toBeHidden()
    })

    await test.step('the app shell is up and the Planner Day view renders', async () => {
      await page.goto('/planner')
      // The Day Canvas home: the hero tracker's punch control and the Co-Planner card.
      await expect(punchButton(page, 'Start')).toBeVisible()
      await expect(page.getByText('Co-Planner').first()).toBeVisible()
    })
  })

  test('REQ-022 · tracking golden path: start the timer on the Planner Day view, then stop without an error', async ({
    page,
    request,
  }) => {
    await signInToToday(page, request)

    await test.step('start the timer', async () => {
      await punchButton(page, 'Start').click()
      // The punch control flips to Stop — the session is live.
      await expect(punchButton(page, 'Stop')).toBeVisible()
    })

    await test.step('let the session accumulate a tracked second', async () => {
      // Wait on *state*, not a fixed sleep: the running hero stopwatch carries
      // `role="timer"` (ReanimatedTimer) and starts at 00:00:00. Polling it off that
      // value proves at least one second was actually tracked, and — because the clock
      // only ticks once the running segment is established — also confirms the async
      // punch-in has fully settled before we try to stop.
      const clock = page.getByRole('timer')
      await expect(clock).toBeVisible()
      await expect(clock).not.toHaveText('00:00:00')
    })

    await test.step('stop the timer', async () => {
      const stop = punchButton(page, 'Stop')
      // The punch button is briefly disabled while a punch is in flight (`timer.busy`);
      // a forced click on a disabled control silently no-ops, so wait it out first. This
      // replaces the old fixed `waitForTimeout` with a deterministic actionability gate.
      await expect(stop).toBeEnabled()
      // While a session is live the punch button intentionally "breathes" (LiveButton, ADR-0048
      // motion) — a continuous ~6% scale that is design, not a bug. That keeps the element from
      // ever reaching Playwright's "stable" state, and reanimated's web reduced-motion detection
      // does not reliably honour the runner's reducedMotion: 'reduce'. Force the click past the
      // stability wait only (enabledness is asserted above): the button is visible and centred,
      // the scale is about its own centre, and every post-click assertion below still fully
      // verifies the stop actually happened.
      await stop.click({ force: true })
      // The confirmation toast lands and the control flips back to Start.
      await expect(page.getByText(/Timer stopped/)).toBeVisible()
      await expect(punchButton(page, 'Start')).toBeVisible()
    })

    await test.step('no error surfaced', async () => {
      await expect(page.getByText(/could not|failed/i)).toHaveCount(0)
    })
  })

  test('REQ-022 · reports golden path: the summary cards render', async ({ page, request }) => {
    await signInToToday(page, request)

    await test.step('navigate to Reports', async () => {
      await page.goto('/reports')
    })

    await test.step('the summary card headings render', async () => {
      await expect(page.getByText('Where did the time go?').first()).toBeVisible()
      await expect(page.getByText('Budgets').first()).toBeVisible()
    })
  })

  test('REQ-043 · keyboard focus is visible on the Planner Day view (accent focus ring)', async ({
    page,
    request,
  }) => {
    await signInToToday(page, request)

    await test.step('tab through the Planner Day view until a visibly focused element appears', async () => {
      let visible = false
      for (let i = 0; i < 15 && !visible; i += 1) {
        await page.keyboard.press('Tab')
        visible = await page.evaluate(() => {
          const el = document.activeElement
          if (!(el instanceof HTMLElement) || el === document.body) return false
          const s = getComputedStyle(el)
          return s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0
        })
      }
      expect(visible, 'no tab stop showed a visible focus outline').toBe(true)
    })
  })
})
