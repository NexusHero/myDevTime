import { test, expect } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * The first acceptance journeys (ADR-0053): the app actually mounts in a browser
 * against the running stack, and a real user can sign in and get past the auth
 * gate. These are the "does it even come up + can I log in" checks the owner asked
 * for — no more manual click-through. Tagged with the REQ they exercise.
 */
test.describe('acceptance · app shell + authentication', () => {
  test('REQ-002 · the web app mounts and renders the sign-in screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible()
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
  })

  test('REQ-002 · a new user can sign up entirely via the UI and reach the app', async ({ page }) => {
    const user = freshUser()
    await page.goto('/')
    
    // Switch to registration screen
    await page.getByRole('button', { name: /create free account/i }).click()
    
    // Fill the registration form
    await page.getByPlaceholder('Suhay Sevinc').fill(user.name)
    await page.getByPlaceholder('you@company.com').fill(user.email)
    await page.getByPlaceholder('At least 8 characters').fill(user.password)
    
    // Submit registration
    await page.getByRole('button', { name: /^create free account$/i }).click()
    
    // Sign-up is complete and automatically authenticates the user in E2E dev stack.
    // The whole registration form leaves the DOM once the session is established. Wait on the
    // form's unique email input rather than the "Create free account" text (rendered twice —
    // heading + submit button) or the submit button alone (which can hide transiently mid-submit,
    // before auth actually completes): the email input unmounts only when the authenticated shell
    // replaces the auth screen — a reliable "auth done" signal.
    await expect(page.getByPlaceholder('you@company.com')).toBeHidden()
  })

  test('REQ-007 · a seeded user can sign in and reach the app', async ({ page, request }) => {
    const user = freshUser()
    await apiSignUp(request, user)
    await uiSignIn(page, user)
    // Past the gate: the sign-in form is gone and the app chrome has taken over.
    await expect(page.getByText('Welcome back')).toBeHidden()
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeHidden()
  })

  test('REQ-007 · wrong password is rejected and keeps the user on the sign-in screen', async ({
    page,
    request,
  }) => {
    const user = freshUser()
    await apiSignUp(request, user)
    await page.goto('/')
    await page.getByPlaceholder('you@company.com').fill(user.email)
    await page.getByPlaceholder('••••••••').fill('definitely-the-wrong-password')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    // Still on the login screen — the gate did not open.
    await expect(page.getByText('Welcome back')).toBeVisible()
  })
})
