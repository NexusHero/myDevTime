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

/** The UTC calendar day (`YYYY-MM-DD`) — the runner is pinned to UTC, so this is "today" app-side too. */
export function utcDayKey(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Seed `evenings` booked work evenings in the CURRENT week (REQ-071 fixtures): one daily
 * `focus` recurring series, 18:00–21:00, anchored at this week's Monday and capped by
 * occurrence count — exactly the `recurrence` feed the Planner week canvas (and the
 * life-care derivation) reads back, so the test judges real persisted state, not a stub.
 * `evenings: 7` books every evening of the shown week; a smaller count leaves the rest free.
 */
export async function seedEveningWork(
  request: APIRequestContext,
  { evenings }: { evenings: number },
): Promise<void> {
  const now = new Date()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  const res = await request.post('/api/recurrence', {
    data: {
      kind: 'focus',
      title: 'Late focus',
      anchorDate: monday.toISOString().slice(0, 10),
      startMin: 18 * 60,
      lenMin: 180,
      freq: 'daily',
      endKind: 'count',
      count: evenings,
    },
  })
  expect(res.ok(), `seedEveningWork failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/**
 * Opt the seeded user into proactive Sevi (REQ-071). Also collapses the quiet-hours window
 * (`start === end` ⇒ no quiet window, per the domain nudge policy): the default 22:00–07:00
 * window would otherwise silence every voice when CI happens to run in that UTC stretch —
 * the gate under test must be deterministic, not an accident of the runner's clock.
 */
export async function enableSevi(request: APIRequestContext): Promise<void> {
  const res = await request.put('/api/preferences', {
    data: { seviProactive: true, quietStartMin: 0, quietEndMin: 0 },
  })
  expect(res.ok(), `enableSevi failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}
