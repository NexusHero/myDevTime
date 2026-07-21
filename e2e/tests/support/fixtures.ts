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

/** The Monday of the current local week as `YYYY-MM-DD` — the Planner's `weekOffset = 0`
 *  column origin, so seeded series land exactly on the visible week canvas. */
export function currentWeekMonday(): string {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${String(monday.getFullYear())}-${p(monday.getMonth() + 1)}-${p(monday.getDate())}`
}

/**
 * Seed a REALLY over-committed current week for the signed-in user (REQ-070) through the
 * same endpoints Sevi's advisory consumes — recurrence series, whose occurrences the
 * Planner's week canvas fetches:
 * - 2 h of `life` time per weekday (16:00–18:00) → the honest plannable week is 40 − 10 = 30 h;
 * - 10 h of `focus` work per weekday (09:00–19:00) → 50 h planned = **+20 h over**.
 * Must be called with an AUTHENTICATED context (e.g. `page.request` after `uiSignIn`) —
 * series are workspace-scoped. Pass `light: true` to seed a comfortably fitting week
 * instead (2 h of focus per weekday, no life time → 10 h planned on a 40 h week).
 */
export async function seedOvercommittedWeek(
  request: APIRequestContext,
  monday: string,
  opts: { readonly light?: boolean } = {},
): Promise<void> {
  const series = opts.light === true
    ? [
        { kind: 'focus', title: 'Light work', startMin: 9 * 60, lenMin: 2 * 60 },
      ]
    : [
        { kind: 'life', title: 'Family time', startMin: 16 * 60, lenMin: 2 * 60 },
        { kind: 'focus', title: 'Deep work', startMin: 9 * 60, lenMin: 10 * 60 },
      ]
  for (const s of series) {
    const res = await request.post('/api/recurrence', {
      data: {
        ...s,
        anchorDate: monday,
        freq: 'daily',
        endKind: 'count',
        count: 5, // Monday..Friday — exactly the visible work week
      },
    })
    expect(
      res.ok(),
      `seed series "${s.title}" failed (${String(res.status())}): ${await res.text()}`,
    ).toBeTruthy()
  }
}
