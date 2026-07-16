# Native app-usage trackers — on-hardware verification protocol (REQ-042)

The Auto-Tracker's deterministic core and its capture **port** are tested in CI
(`summarizeActivity`, `diffUsage`, `nativeUsageCapture`, the web adapter — see the
[traceability matrix](../testing/requirements-traceability.md)). The two **native**
adapters cannot be built or run in this repo's CI/dev environment, so they ship as
documented scaffolds:

- **Android** — `UsageStatsManager` module (`apps/mobile/native/mydevtime-usage/`,
  [ADR-0058](../adr/0058-native-app-usage-capture.md)).
- **macOS / Windows** — Electron + `active-win` companion (`desktop-companion/`,
  [ADR-0059](../adr/0059-desktop-usage-companion.md)).

This document is the **on-hardware step**: it does not build anything itself — it says
what to run (the two READMEs own the build commands), what "verified" looks like, and
**what to change in the repo once it passes**, so the result is recorded rather than
lost. It needs a real Android device and a Mac and/or Windows machine; there is no such
hardware in CI, so this step is inherently manual.

## Why it can't run here

The managed/web build runs in a browser sandbox with no OS access; Expo Go never loads
native modules; CI has no Android device, no macOS/Windows desktop, and cannot build an
Electron or Dev-Client binary. Every figure the trackers show is still the deterministic
core's (`summarizeActivity`) — verified in CI — so this step proves the **capture** half
(reading the OS + the permission flow), not the arithmetic.

## Track A — Android (`UsageStatsManager`)

1. Build a Dev Client and activate the module by following
   [`apps/mobile/native/mydevtime-usage/README.md`](../../apps/mobile/native/mydevtime-usage/README.md)
   ("Activating it" + "The JS entry to add on activation"). Expo Go cannot load it.
2. On the device, grant **Usage access** when `requestPermission()` opens Settings
   (Settings → Apps → Special access → Usage access → myDevTime → Allow).
3. Enable the Auto-Tracker (`autoTracker` opt-in in Settings) and start a timer.

**Acceptance criteria**

- [ ] With permission **denied**, `hasPermission()` is `false` and capture falls back to
      the honest null adapter (no crash, no fabricated split).
- [ ] With permission **granted**, the Today Auto-Tracker card shows a real per-app split
      whose sources are actual package/app names you used while tracking.
- [ ] The split only accrues **while a timer runs** (session-gated) and resets per session.
- [ ] Nothing is uploaded — capture is local-only (confirm no network calls carry the
      per-app data; the split is summarized on-device).

## Track B — macOS / Windows (desktop companion)

1. Build and run per [`desktop-companion/README.md`](../../desktop-companion/README.md)
   ("Build & run"): `pnpm --filter @mydevtime/domain build`, then in `desktop-companion/`
   `pnpm install && pnpm start`.
2. **macOS only**: grant **Screen Recording** (System Settings → Privacy & Security →
   Screen Recording) so `active-win` can read window/app owners; restart the companion.
3. Click **Start** in the companion window and switch between a few apps.

**Acceptance criteria**

- [ ] The companion window opens and **Start/Stop** toggle capture (consent-gated — nothing
      runs until you press Start).
- [ ] The breakdown lists the apps you focused, with plausible shares that sum to 100%
      (the largest-remainder rounding of the shared core).
- [ ] Stopping halts updates; closing the window stops the tracker.
- [ ] Everything stays on the machine — no upload (app names only).

## When it passes — record it

Verification only counts once it's written down. On success, in a follow-up PR:

1. **Tech Radar** ([`docs/adr/README.md`](../adr/README.md)) — move the ring for the
   verified adapter from **Trial** to **Adopt**: the ADR-0058 row (Android) and/or the
   ADR-0059 row (desktop). Note the platform + OS version you verified on.
2. **Requirements Register** ([`docs/architecture.md`](../architecture.md) §1, REQ-042) —
   replace "unverified in CI" for the verified adapter with "verified on <device / OS>",
   keeping the rest of the Partial note intact.
3. If you add an automated device/e2e check, add its path to the REQ-042 row in the
   [traceability matrix](../testing/requirements-traceability.md).

Verify one adapter at a time; each flips its own row independently.

## Troubleshooting

- **Android split is empty with permission granted** — `queryUsageStats` needs a short
  window of foreground activity after the grant; use a couple of apps for ~1 minute, then
  re-check. Confirm the JS entry actually ran `registerNativeUsageModule(native)` at app
  start (import it once from `App.tsx`).
- **macOS shows only "Unknown"** — Screen Recording isn't granted (or the app wasn't
  restarted after granting); `active-win` can't read owners without it.
- **`pnpm start` can't resolve `@mydevtime/domain`** — run the domain build first
  (step 1); the companion imports the built package by `file:` path.

## Pair on it

I can't run the hardware step, but I can debug it with you: run the steps above and paste
the console output / any error (Metro logs, `adb logcat`, the Electron console) into the
PR, and I'll diagnose and push fixes to the scaffold. The scaffolds are deliberately
outside `./test.sh`, so fixes there don't affect the app's gate.
