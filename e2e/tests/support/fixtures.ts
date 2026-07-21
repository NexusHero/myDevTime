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
 * Seed helpers for the journey specs. They talk to the same **real** tracking
 * endpoints the app uses (never fabricated rows), through the STANDALONE
 * `request` fixture: `apiSignUp(request, …)` leaves the Better-Auth session
 * cookie in that context, so subsequent `request.post(...)` calls write as the
 * seeded user while the page's cookie jar stays clean for `uiSignIn` (running
 * sign-up through `page.request` would log the browser in and the login form
 * would never render — the bug the golden paths were bitten by).
 */

/** A seeded client → project → task triple (REQ-001 catalog shape). */
export interface SeededCatalog {
  readonly clientId: string
  readonly clientName: string
  readonly projectId: string
  readonly projectName: string
  readonly taskId: string
  readonly taskName: string
}

/** POST a JSON body and parse the created row, failing loudly on a non-2xx. */
async function postSeed(
  request: APIRequestContext,
  path: string,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await request.post(path, { data })
  expect(res.ok(), `${path} failed (${String(res.status())}): ${await res.text()}`).toBeTruthy()
  return (await res.json()) as { id: string }
}

/**
 * Create a client → project → task via the real tracking catalog endpoints
 * (`POST /api/tracking/{clients,projects,tasks}`, REQ-001). Names are stable
 * per call site — every test runs in a fresh user's empty workspace.
 */
export async function seedCatalog(
  request: APIRequestContext,
  names: { client?: string; project?: string; task?: string } = {},
): Promise<SeededCatalog> {
  const clientName = names.client ?? 'Acme GmbH'
  const projectName = names.project ?? 'Website Relaunch'
  const taskName = names.task ?? 'Fix login redirect'
  const client = await postSeed(request, '/api/tracking/clients', { name: clientName })
  const project = await postSeed(request, '/api/tracking/projects', {
    name: projectName,
    clientId: client.id,
  })
  const task = await postSeed(request, '/api/tracking/tasks', {
    name: taskName,
    projectId: project.id,
  })
  return {
    clientId: client.id,
    clientName,
    projectId: project.id,
    projectName,
    taskId: task.id,
    taskName,
  }
}

/** A completed time entry to seed via the real entries endpoint. */
export interface SeedEntryInput {
  readonly startedAt: string
  readonly endedAt: string
  readonly projectId?: string
  readonly taskId?: string
  readonly note?: string
  readonly billable?: boolean
}

/**
 * Book a completed entry via the real `POST /api/tracking/entries` (the same
 * route the app's manual/NL confirm step uses). The server's deterministic core
 * validates the interval (ADR-0005) — nothing is faked into the table.
 */
export async function seedEntry(
  request: APIRequestContext,
  entry: SeedEntryInput,
): Promise<{ id: string }> {
  return postSeed(request, '/api/tracking/entries', { ...entry })
}

/**
 * Today's date as the UTC `YYYY-MM-DD` key. The runner is pinned to
 * `timezoneId: 'UTC'`, so instants seeded at `${todayUtc()}T09:00:00.000Z`
 * render on "today" deterministically, exactly like the worktime persona seeds.
 */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}
