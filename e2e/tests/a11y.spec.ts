import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * Accessibility acceptance (REQ-043, ADR-0062). Runs the axe-core engine against the
 * real app in a browser and fails on any **critical or serious** WCAG 2.0/2.1 A/AA
 * violation on the core screens — the automated a11y gate the issue asks for. Plus a
 * keyboard-only pass of the sign-in golden path, so the primary flow is provably
 * operable without a pointer. Contrast is already enforced in the design package;
 * here we check structure, names/roles, and keyboard operability end to end.
 */
const SERIOUS = ['critical', 'serious']

/** Only the tags we hold ourselves to (WCAG A/AA), so axe's best-practice noise doesn't gate. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('acceptance · accessibility', () => {
  test('REQ-043 · the sign-in screen has no critical/serious a11y violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Welcome back')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()
    const blocking = results.violations.filter(v => SERIOUS.includes(v.impact ?? ''))
    expect(blocking, JSON.stringify(blocking.map(v => ({ id: v.id, impact: v.impact })), null, 2)).toEqual([])
  })

  test('REQ-043 · the app (Today) has no critical/serious a11y violations after sign-in', async ({
    page,
    request,
  }) => {
    const user = freshUser()
    await apiSignUp(request, user)
    await uiSignIn(page, user)

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()
    const blocking = results.violations.filter(v => SERIOUS.includes(v.impact ?? ''))
    expect(blocking, JSON.stringify(blocking.map(v => ({ id: v.id, impact: v.impact })), null, 2)).toEqual([])
  })

  test('REQ-043 · the sign-in golden path is operable by keyboard alone', async ({
    page,
    request,
  }) => {
    const user = freshUser()
    await apiSignUp(request, user)

    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('mydevtime.onboarded', '1'))

    // Focus the email field, then drive the whole form with the keyboard: type,
    // Tab to the password, type, and submit with Enter — no mouse.
    const email = page.getByPlaceholder('you@company.com')
    await email.focus()
    await expect(email).toBeFocused()
    await page.keyboard.type(user.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(user.password)
    await page.keyboard.press('Enter')

    // Past the gate: the login form is gone, the app has taken over.
    await expect(page.getByText('Welcome back')).toBeHidden()
  })
})
