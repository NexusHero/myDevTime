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
