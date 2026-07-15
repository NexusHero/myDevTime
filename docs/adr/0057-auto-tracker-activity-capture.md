# ADR 0057: Auto-Tracker — deterministic activity aggregation behind a capture port

## Status

Accepted (owner decision) — realizes REQ-042; bound by the deterministic-core rule
([ADR-0005](0005-deterministic-core-llm-assist.md)) and the ports-&-adapters rule
(SKILL §2.2); consent-gated in the same spirit as meeting capture (REQ-025).

## Context

The Today screen has an "Auto-Tracker" card — the design shows a live breakdown of
where the session's time went (per app, with percentages). Until now it was an honest
empty state; the persisted `autoTracker` preference (M10) and the onboarding opt-in
(with three privacy promises) were the only real pieces.

Making it real runs into a hard platform reality: **capturing *other* apps' usage is
not uniformly possible** from a managed Expo app.

- **iOS** — no public API for other apps' foreground time. Impossible.
- **Web** — the browser is sandboxed; a page can see only its *own* tab, never other
  apps.
- **Android** — `UsageStatsManager` exists but needs a native module, a config plugin,
  a Dev Client, and the special `PACKAGE_USAGE_STATS` grant.
- **Desktop** — the web build runs in a browser with no OS access; real desktop
  capture would need a separate native companion (Electron/Tauri).

So a single "watches every app" tracker cannot be honest across platforms today, and
fabricating a plausible-looking breakdown would violate the product's core promise
(numbers are real, ADR-0005).

## Decision

Split the feature along the deterministic/volatile seam and ship the parts that are
genuinely real now, degrading honestly everywhere else.

1. **Deterministic core** in `@mydevtime/domain` (`autotracker/activity.ts`,
   `summarizeActivity`): pure, framework-free, exhaustively tested. It turns raw
   activity spans into a percentage-correct breakdown (merge by source, drop
   non-positive spans, stable ordering, optional top-N with an "Others" fold,
   largest-remainder percentages that total 100). No clock, no I/O.
2. **A narrow capture port** on the client (`apps/mobile/src/autotracker/capture.ts`,
   `ActivityCapture`) with the volatile logic isolated behind it:
   - `nullCapture` — the honest no-op where OS capture is impossible (iOS, native
     today); it emits nothing, so the UI shows its empty state.
   - `webCapture` — a **real first-party** adapter: it observes only the app's own tab
     via the Page Visibility API plus an input-idle heuristic, reporting `Active` /
     `Idle` / `Away`. It never inspects other apps. Its heart is a pure, injectable-clock
     `SpanAccumulator` so the accumulation is unit-tested without wall-clock.
   - `platformCapture` picks the web adapter on web, the null adapter elsewhere.
3. **Consent- and session-gated** (`useAutoTracker`): capture runs only when the
   `autoTracker` preference is on **and** a timer is active, and only where a real
   adapter exists. Spans are **local-only** — accumulated in memory, summarized
   client-side, never persisted or sent to the server.
4. **Honest Today wiring**: a real breakdown when there is data; otherwise an empty
   state whose copy names the actual reason (off / not-yet-tracking / platform not
   supported).

Real OS-level app capture (Android `UsageStatsManager`; a desktop companion) is a
**future adapter behind this same port** — the core, the port, and the UI do not
change when it lands.

## Consequences

- **Pros**: the visible number is real and privacy-safe on web (own-tab activity,
  no other-app snooping, nothing leaves the device); the deterministic core is fully
  tested and reused by any future adapter; the feature degrades honestly instead of
  faking data; consent-first is enforced by construction.
- **Cons / limits**: on iOS and native Android/desktop the card stays an honest empty
  state until a native adapter exists — the web adapter's `Active/Idle/Away` split is
  coarser than the design's per-app mock (VS Code / Chrome / Terminal), which is only
  achievable with real OS capture. This is deliberate: coarse-but-true over rich-but-fake.
- **Reversible**: the core is additive; the client seam is one folder. Adding a native
  adapter is a new file implementing `ActivityCapture`, no change upstream.
