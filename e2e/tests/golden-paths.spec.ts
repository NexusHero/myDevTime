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

/** Sign in and land on the Today surface. */
async function signInToToday(page: Page, request: Parameters<typeof apiSignUp>[0]): Promise<void> {
  const user = freshUser('golden')
  await apiSignUp(request, user)
  await uiSignIn(page, user)
  await page.goto('/today')
  await expect(punchButton(page, 'Start')).toBeVisible()
}

test.describe('acceptance · golden paths', () => {
  test('REQ-022 · auth golden path: register via the UI and reach the Today surface', async ({
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
      // Sign-up auto-authenticates in the E2E stack — the form leaves the DOM.
      await expect(page.getByText('Create free account')).toBeHidden()
    })

    await test.step('the app shell is up and Today renders', async () => {
      await page.goto('/today')
      // The Day Canvas home: the hero tracker's punch control and the Co-Planner card.
      await expect(punchButton(page, 'Start')).toBeVisible()
      await expect(page.getByText('Co-Planner').first()).toBeVisible()
    })
  })

  test('REQ-022 · tracking golden path: start the timer on Today, then stop without an error', async ({
    page,
    request,
  }) => {
    await signInToToday(page, request)

    await test.step('start the timer', async () => {
      await punchButton(page, 'Start').click()
      // The punch control flips to Stop — the session is live.
      await expect(punchButton(page, 'Stop')).toBeVisible()
    })

    // Let the timer actually tick before stopping.
    await page.waitForTimeout(1500)

    await test.step('stop the timer', async () => {
      await punchButton(page, 'Stop').click()
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

  test('REQ-043 · keyboard focus is visible on Today (accent focus ring)', async ({
    page,
    request,
  }) => {
    await signInToToday(page, request)

    await test.step('tab through Today until a visibly focused element appears', async () => {
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
