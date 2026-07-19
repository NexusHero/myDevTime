import { defineConfig, devices } from '@playwright/test'

/**
 * Acceptance (E2E) config (ADR-0053). Tests drive the *built* web app in a real
 * browser against the running Docker stack (web/nginx → api → Postgres/Redis) — the
 * same artifacts we ship. `E2E_BASE_URL` points at the stack (the web origin, whose
 * nginx also proxies `/api`); defaults to the compose-published port so a local
 * `docker compose up` + `pnpm test` just works.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  // A generous global expect timeout: a cold container stack is slower than a dev server.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Emulate `prefers-reduced-motion: reduce` so the design system's continuous
    // animations (Island/LiveButton pulse, tracker breathing — all gated on
    // reanimated's `useReducedMotion`, which reads this media query on web) settle
    // to their target state. Without it a perpetually-animating punch control never
    // reaches a stable box and `click()` retries until timeout — the flake that made
    // the timer start/stop golden path fail intermittently. Motion is a11y-gated in
    // production anyway, so this tests the same behaviour, deterministically.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
