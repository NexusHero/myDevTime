# ADR 0059: Desktop app-usage companion (macOS / Windows)

## Status

Accepted (owner decision) — **extends [ADR-0057](0057-auto-tracker-activity-capture.md)
/ [ADR-0058](0058-native-app-usage-capture.md)**. Realizes the desktop half of the
Auto-Tracker's "real OS capture is a follow-up" (REQ-042) for macOS and Windows; bound
by the deterministic-core rule (ADR-0005) and the local-only, consent-first stance.

## Context

ADR-0058 advanced native per-app capture on **Android** (a `UsageStatsManager` module
behind the tested `NativeUsageModule` port). The owner also wants **macOS and Windows**.
The web/managed build runs in a browser sandbox with no OS access, so — as ADR-0057
noted — desktop capture needs a **separate native companion process**. iOS remains
impossible (no API for other apps).

The same environment constraint from ADR-0058 applies: this repo's CI/dev environment
**cannot build or run an Electron/desktop binary**, so a desktop companion cannot be
verified here. It must ship as a documented scaffold that reuses what is already tested.

## Decision

Ship a **standalone desktop companion** — `desktop-companion/` — that captures the
focused application on macOS/Windows and renders the breakdown **locally**, reusing the
project's deterministic core instead of duplicating it.

1. **Reuse, don't re-implement**: the companion imports `summarizeActivity` from
   `@mydevtime/domain` (the same pure percentage-correct aggregation the mobile web
   adapter uses) — so every figure is the core's, tested once, shared everywhere.
2. **Electron + `active-win`**: the main process polls the OS for the foreground app
   (title/owner) on an interval, accumulates cumulative foreground ms per app, and turns
   the between-poll deltas into spans — the same cumulative→span accounting shape as
   ADR-0058's `diffUsage`. The renderer shows the local breakdown.
3. **Local-only + consent-first**: the companion tracks only while the user has it
   running and enabled, keeps everything **on the machine** (no upload — the server
   ingest was rejected on data-protection grounds), and captures app names only.
4. **Outside the app workspace**: the companion is a top-level folder with its own
   toolchain (like `spikes/`), **not** a pnpm-workspace member — so its Electron/native
   deps and its unverified binary never enter the app's `./test.sh` gate. It is a
   documented, build-it-locally scaffold, not a running feature in this repo.

## Consequences

- **Pros**: macOS/Windows get real per-app capture via one small companion that reuses
  the tested deterministic core; the mobile app, its port and its gate are untouched;
  the privacy stance (local-only, consent-first, app-names-only) is preserved.
- **Cons / limits**: the Electron companion is **unverified in this environment** — it
  needs a local `pnpm install && pnpm start` on a Mac/Windows machine to build and prove
  out, and is shipped as a documented scaffold. It is a **separate process**, so it does
  not feed the mobile app's in-process `ActivityCapture` port; it renders its own local
  view. `active-win` needs Screen Recording permission on macOS.
- **Reversible**: deleting `desktop-companion/` removes it with zero effect on the app;
  it depends on `@mydevtime/domain` one-way.
