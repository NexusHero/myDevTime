import { type APIRequestContext, type Page, expect } from '@playwright/test'

/**
 * Shared acceptance helpers. The app's LoginScreen is sign-in only, so tests seed
 * a fresh user through the Better-Auth API first, then sign in through the real UI.
 * Email verification is off in the E2E stack (ADR-0053) so the seeded account can
 * sign in immediately. Every test uses a unique email → runs are independent.
 */
export interface TestUser {
  readonly email: string
  readonly password: string
  readonly name: string
}

let seq = 0

/** A unique test user each call, so parallel/repeat runs never collide. */
export function freshUser(prefix = 'e2e'): TestUser {
  seq += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return {
    email: `${prefix}-${String(Date.now())}-${String(seq)}-${rand}@example.test`,
    password: 'E2e-passw0rd!',
    name: 'E2E User',
  }
}

/** Create the account via the Better-Auth email sign-up endpoint (same origin as the app). */
export async function apiSignUp(request: APIRequestContext, user: TestUser): Promise<void> {
  const res = await request.post('/api/auth/sign-up/email', {
    data: { email: user.email, password: user.password, name: user.name },
  })
  expect(res.ok(), `sign-up failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/** Sign in through the LoginScreen and wait until the auth gate lets the app through. */
export async function uiSignIn(page: Page, user: TestUser): Promise<void> {
  await page.goto('/')
  // Bypass the onboarding flow by pre-setting the completed flag in localStorage
  await page.evaluate(() => localStorage.setItem('mydevtime.onboarded', '1'))
  await page.getByPlaceholder('you@company.com').fill(user.email)
  await page.getByPlaceholder('••••••••').fill(user.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  // The login form leaves the DOM once the session is established.
  await expect(page.getByText('Welcome back')).toBeHidden()
}

/**
 * Store the explicit mood-memory opt-in (ADR-0071 P3, REQ-068) for the signed-in user. Pass an
 * AUTHENTICATED context (`page.request` after `uiSignIn`) — the standalone `request` fixture
 * carries no session cookie and the preferences route sits behind the auth guard.
 */
export async function enableMoodConsent(request: APIRequestContext): Promise<void> {
  const res = await request.put('/api/preferences', { data: { moodConsent: true } })
  expect(res.ok(), `mood consent failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/** One seeded mood day for `seedMoodSeries` — the server's closed vocabulary, day overridden. */
export interface MoodSeed {
  readonly day: string
  readonly mood: 'good' | 'tense' | 'stressed'
}

/**
 * Seed a mood series through the REAL consent-gated endpoint (`POST /api/wellbeing/mood` with
 * the per-entry day override) — call `enableMoodConsent` first, and pass the same
 * authenticated context (`page.request`); without the stored opt-in the server answers 409.
 */
export async function seedMoodSeries(
  request: APIRequestContext,
  entries: readonly MoodSeed[],
): Promise<void> {
  for (const entry of entries) {
    const res = await request.post('/api/wellbeing/mood', { data: entry })
    expect(
      res.ok(),
      `mood seed for ${entry.day} failed (${String(res.status())}): ${await res.text()}`,
    ).toBeTruthy()
  }
}
