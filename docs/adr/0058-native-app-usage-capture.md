# ADR 0058: Native OS app-usage capture behind the Auto-Tracker port

## Status

Accepted (owner decision) — **extends [ADR-0057](0057-auto-tracker-activity-capture.md)**
(the deterministic core, the `ActivityCapture` port and the local-only, consent-gated
stance all stand). Advances REQ-042's "real OS capture is a follow-up behind the same
port" toward Android; bound by ADR-0005 and the ports-&-adapters rule (SKILL §2.2).

## Context

ADR-0057 shipped the Auto-Tracker with a first-party **web** adapter (own-tab
Active/Idle/Away) and honest null adapters elsewhere, and left real per-app OS capture
as a follow-up. The owner asked for a native app tracker. The platform reality is
unchanged and hard:

- **iOS** — no public API for other apps' foreground time. **Impossible.**
- **Android** — `UsageStatsManager` gives per-app cumulative foreground time, but only
  from a **native module** (Kotlin) shipped in a **Dev Client / prebuild** build with
  the special `PACKAGE_USAGE_STATS` grant — not available in the managed/Expo Go build.
- **Desktop (Mac/Windows)** — the web build runs in a browser with no OS access; real
  desktop capture needs a separate native companion (Electron/Tauri).

A further constraint shaped this ADR: the CI/dev environment for this repo **cannot
build or run a Dev Client / on-device build**, so native binary code cannot be verified
here. Shipping unverified native code as "done" would violate the project's honesty bar.

## Decision

Split the native tracker along the verifiable/unverifiable seam and ship only the parts
that are real and tested now, keeping the native binary a clean, documented drop-in.

1. **A narrow native port + a tested adapter** (`apps/mobile/src/autotracker/nativeUsage.ts`):
   `NativeUsageModule` is the one interface a native module implements (`query()` →
   cumulative per-app totals, plus permission gating). `diffUsage` turns two cumulative
   readings into the per-interval spans the deterministic `summarizeActivity` consumes —
   baseline on first read, positive deltas after, counter-reset safe — and is
   exhaustively unit-tested. `nativeUsageCapture` is the `ActivityCapture` that polls the
   module and feeds those spans. **All of this is verified here**, with injected
   module/timers, because it contains no native code.
2. **A null-returning resolver** (`nativeUsageModule()` in `capture.ts`): the managed /
   web build has no native module, so `platformCapture` on Android falls back to the
   honest null adapter (empty state) instead of a fabricated breakdown. A Dev Client
   build replaces that one function body with `requireNativeModule('MydevtimeUsage')` —
   the single line that turns the dormant Android path live. Nothing upstream changes.
3. **The native module as a documented scaffold** (`apps/mobile/native/mydevtime-usage/`):
   the Expo module config, the Android `UsageStatsManager` reader (Kotlin), the JS bridge
   and the prebuild/permission steps — real reference files plus a README, **clearly
   marked as requiring an on-device Dev Client build to activate and verify**. It is not
   wired into the managed build, so it cannot break it.
4. **Local-only, consent- and session-gated** (unchanged from ADR-0057): native spans are
   summarized on-device and never uploaded (the server ingest was rejected on
   data-protection grounds); capture runs only under the `autoTracker` opt-in while a
   timer is active.

Desktop (Electron/Tauri) capture stays a future adapter behind the same port, on the
same terms.

## Consequences

- **Pros**: the accounting that turns raw OS usage into a trustworthy breakdown is real
  and tested now; activating Android is a one-line resolver change plus a Dev Client
  build; the port/core/UI are untouched; the feature degrades honestly on iOS, web and
  the managed Android build instead of faking data.
- **Cons / limits**: the native module and permission flow are **unverified in this
  environment** — they need an on-device build to prove out, and are shipped as a
  documented scaffold, not a running feature. iOS remains impossible; desktop remains a
  separate companion. Coarse-but-true over rich-but-fake still holds.
- **Reversible**: deleting the scaffold and the resolver leaves ADR-0057's behaviour
  exactly; the tested adapter is dormant without a module to drive it.
