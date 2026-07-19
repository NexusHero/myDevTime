# E2E (acceptance) coverage map

**Requirement:** REQ-022 — a launch-gating end-to-end suite that is flake-free, with a
checked-in coverage map. **Issue:** #27. **Decision:** ADR-0053 (Playwright drives the *built*
web app in a real browser against the docker-composed stack: web/nginx → api → Postgres/Redis).

This document is the checked-in coverage map the issue asks for. It records which journey and
feature each acceptance test covers, how empty / loading / error states are exercised, and the
runtime criterion that is *not* satisfiable inside a single CI job (the 20-consecutive-green
flake gate).

## Where the suite lives

| File | Scope |
|------|-------|
| `e2e/playwright.config.ts` | Runner config: base URL, timeouts, retries, trace, and the determinism settings below. |
| `e2e/tests/support/fixtures.ts` | Shared helpers: `freshUser` (unique email per call → runs are independent), `apiSignUp` (Better-Auth seed), `uiSignIn` (sign in through the real LoginScreen). |
| `e2e/tests/shell-auth.spec.ts` | App shell mounts + authentication gate. |
| `e2e/tests/golden-paths.spec.ts` | The three daily golden journeys (auth → Today → Reports) + a keyboard-focus check. |
| `e2e/tests/user-personas.spec.ts` | Work-time personas (Light / Normal / Heavy) and ArbZG §4 break-rule warnings. |
| `e2e/tests/a11y.spec.ts` | axe-core WCAG A/AA gate + keyboard/role operability (REQ-043). Owned separately; listed here so the map is complete. |

## Determinism / anti-flake conventions

These are the rules the suite is held to; new specs must follow them.

- **Reduced motion is emulated** (`use.reducedMotion: 'reduce'`) so the design system's
  continuous animations (Island/LiveButton pulse, tracker "breathing") settle to their target
  state instead of never reaching Playwright's *stable* box.
- **Intentionally-animated controls** (the live "Stop" punch button, which breathes via
  `LiveButton`, ADR-0048) are clicked with `{ force: true }` to skip *only* the stability wait —
  and only after an explicit `toBeEnabled()` assertion, so a forced click can never silently
  no-op against a control that is still disabled while a punch is in flight (`timer.busy`).
- **No arbitrary sleeps.** Waiting for the timer to accumulate a tracked second is done by
  polling the running stopwatch (`role="timer"`) off its initial `00:00:00`, not with
  `waitForTimeout`. State-based `expect` auto-waiting replaces every fixed delay.
- **Never assert the live (per-second) timer value.** The running clock re-renders each second;
  specs assert *state changes* (e.g. "no longer `00:00:00`"), never a specific ticking value.
- **Role + accessible-name selectors** (`getByRole`, `getByLabel`, `getByPlaceholder`) over raw
  text, so specs survive styling churn and avoid strict-mode violations from a phrase that is
  rendered more than once (e.g. "Create free account" appears as both a heading and a submit
  button on the Register screen → assertions target the *button*).
- **Fixed clock/locale** (`timezoneId: 'UTC'`, `locale: 'en-US'`) so date-sensitive journeys
  (the worktime personas inject shifts at UTC instants and assert the rendered day) are
  reproducible regardless of where CI runs.
- **`trace: 'on-first-retry'`, `retries: 1` in CI**, generous cold-stack timeouts (60 s test /
  15 s expect). Retries are a diagnostic net, not a flake mask — the flake gate below is what
  proves stability.

## Coverage map — journeys & features

| Golden path / feature | REQ | Spec · test | Notes |
|-----------------------|-----|-------------|-------|
| Web app mounts, sign-in screen renders | REQ-002 | `shell-auth` · *the web app mounts and renders the sign-in screen* | Asserts heading, email field, Sign-in button. |
| Sign up entirely via the UI → reach the app | REQ-002 | `shell-auth` · *a new user can sign up entirely via the UI and reach the app* | Register form leaves the DOM on auto-auth. |
| Seeded user signs in → past the gate | REQ-007 | `shell-auth` · *a seeded user can sign in and reach the app* | Login form + Sign-in button become hidden. |
| Auth golden path: register via UI → Today surface | REQ-022 | `golden-paths` · *auth golden path* | Lands on Today; asserts punch control + Co-Planner card. |
| Tracking golden path: start → stop timer, no error | REQ-022 | `golden-paths` · *tracking golden path* | Start flips to Stop; waits a tracked second via `role="timer"`; forced Stop; "Timer stopped" toast; flips back to Start. |
| Reports golden path: summary cards render | REQ-022 | `golden-paths` · *reports golden path* | Asserts "Where did the time go?" and "Budgets" headings. |
| Keyboard focus visible on Today (accent ring) | REQ-043 | `golden-paths` · *keyboard focus is visible on Today* | Tabs until a control shows a computed outline. |
| Work-time punch clock: empty week, not clocked in | REQ-028 | `user-personas` · *Light User* | Empty-state + idle punch clock. |
| Compliant shift renders, no warning badges | REQ-028 | `user-personas` · *Normal User* | 8:00 net / 1:00 break; "Break short" badge absent. |
| ArbZG §4 break shortfall warning on overbooked shift | REQ-028 | `user-personas` · *Heavy User (Burnout Candidate)* | 9:30 gross / 0 break → "Break short 0:45" badge. |
| Sign-in screen: no critical/serious a11y violations | REQ-043 | `a11y` · *the sign-in screen…* | axe-core WCAG A/AA. |
| Today: no critical/serious a11y violations | REQ-043 | `a11y` · *the app (Today)…* | axe-core WCAG A/AA after sign-in. |
| Sign-in golden path operable by keyboard alone | REQ-043 | `a11y` · *…operable by keyboard alone* | Keyboard-only field entry + Enter to submit. |
| Golden path reachable by role | REQ-043 | `a11y` · *…reachable by role* | Every step located via the accessibility tree. |
| Tab lands on a focusable control with a visible ring | REQ-043 | `a11y` · *tabbing on Today…* | Focus ring is *visible*, not just present. |

## Coverage map — empty / loading / error states

| State | Covered? | Spec · test | Notes |
|-------|----------|-------------|-------|
| **Empty** — work-time week with no shifts | ✅ | `user-personas` · *Light User* | Asserts "No shifts this week yet." + "Not clocked in". |
| **Empty** — no plan / no uncategorized entries on Today | ➖ implicit | — | Today's Co-Planner/Auto-Tracker render honest empty states; not asserted directly. Candidate follow-up. |
| **Error** — wrong password rejected | ✅ | `shell-auth` · *wrong password is rejected…* | Gate stays closed ("Welcome back" remains). |
| **Error** — no error surfaced on a successful stop | ✅ | `golden-paths` · *tracking golden path* | Negative check: `/could not|failed/i` count is 0. |
| **Error** — work-time shifts fail to load ("Couldn't load shifts") | ❌ gap | — | The screen has an error branch; not yet exercised end-to-end. Candidate follow-up. |
| **Loading** — spinners/"Loading…" placeholders | ➖ implicit | — | Load latency is absorbed by state-based auto-waiting rather than asserted; a dedicated slow-network loading assertion is a candidate follow-up. |

Legend: ✅ asserted · ➖ implicitly exercised / not asserted · ❌ not yet covered (tracked as a
follow-up, not a regression).

## Flake gate (runtime criterion — not satisfiable in a single CI job)

The hardening above (state-based waits, forced-click-with-enabled-gate on animated controls,
role selectors, fixed clock/locale, reduced motion) makes the suite deterministic *by
construction*. The remaining, purely observational acceptance criterion for REQ-022 is:

> **The suite must pass 20 consecutive green CI runs** with no quarantines and no
> retry-masked flakes before it is declared launch-gating.

This can only be demonstrated by watching CI over time; it cannot be produced from a single
run. Track it against the merged workflow and record the run range here once met. A single red
run inside the window resets the count and the offending test is root-caused (not retried away).

## Out of scope — mobile e2e (separate follow-up)

This suite is **web only** (react-native-web through the shipped web/nginx artifact). Native
iOS/Android acceptance flows (Maestro or Detox against the Expo app) are a **separate
follow-up**, not part of REQ-022 / issue #27. They will get their own coverage map when that
work is scheduled.
