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

// ─── Sevi acceptance seams (ADR-0071, REQ-067..069) ────────────────────────────────────────
// All helpers below drive the REAL endpoints with the signed-in request context —
// nothing is stubbed, so the specs prove the same wire the app uses.

const HOUR_MS = 3_600_000

/**
 * Seed one COMPLETED shift for today via `POST /api/worktime/shifts`
 * (`CreateShiftDto`: startedAt + endedAt required, breakMs/source optional). The
 * window is `[now − hoursAgo, now − hoursAgo + hours]` — keep it in the past. The
 * e2e browser is pinned to UTC (playwright.config), and the client attributes a
 * completed shift to the local day it ENDED, so any end instant earlier today
 * lands on today's live-load input.
 */
export async function seedTodayShift(
  request: APIRequestContext,
  opts: { hoursAgo: number; hours: number; breakMin?: number },
): Promise<void> {
  const startedAt = new Date(Date.now() - opts.hoursAgo * HOUR_MS).toISOString()
  const endedAt = new Date(Date.now() - (opts.hoursAgo - opts.hours) * HOUR_MS).toISOString()
  const res = await request.post('/api/worktime/shifts', {
    data: {
      startedAt,
      endedAt,
      breakMs: (opts.breakMin ?? 0) * 60_000,
      source: 'manual',
    },
  })
  expect(res.ok(), `seed shift failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/** Patch the Sevi-relevant preferences via the real `PUT /api/preferences`. */
export async function setSeviPrefs(
  request: APIRequestContext,
  patch: Partial<{
    seviProactive: boolean
    moodConsent: boolean
    quietStartMin: number
    quietEndMin: number
  }>,
): Promise<void> {
  const res = await request.put('/api/preferences', { data: patch })
  expect(res.ok(), `set prefs failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/** The caller's stored mood history (newest first) via `GET /api/wellbeing/mood`. */
export async function readMoodHistory(
  request: APIRequestContext,
): Promise<{ day: string; mood: string }[]> {
  const res = await request.get('/api/wellbeing/mood')
  expect(res.ok(), `read moods failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
  return (await res.json()) as { day: string; mood: string }[]
}

/** Erase the caller's whole mood history via `DELETE /api/wellbeing/mood`. */
export async function deleteMoodHistoryViaApi(request: APIRequestContext): Promise<void> {
  const res = await request.delete('/api/wellbeing/mood')
  expect(res.ok(), `delete moods failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}

/**
 * Book a 🛡 protected window covering the current hour (UTC — matching the pinned
 * browser zone) via the real plan-apply seam (`POST /api/planner/apply`).
 */
export async function protectNow(request: APIRequestContext): Promise<void> {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes()
  const res = await request.post('/api/planner/apply', {
    data: {
      proposal: {
        kind: 'protect-time',
        day,
        startMin: Math.max(0, minute - 30),
        endMin: Math.min(1440, minute + 60),
      },
    },
  })
  expect(res.ok(), `protect failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
}
