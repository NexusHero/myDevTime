# On-device validation plan — ADR-0004 residual C1–C7 (#152) + headless action layer (REQ-039, #49)

**Issues:** [#152](https://github.com/NexusHero/myDevTime/issues/152) (checklist sign-off) ·
[#49](https://github.com/NexusHero/myDevTime/issues/49) (system quick actions, REQ-039) ·
**Decides:** dropping "provisional" from [ADR-0004](../adr/0004-react-native-expo-client.md) ·
**Origin:** [spike #1 findings](../spikes/0001-client-rn-expo.md), residual checklist C1–C7

## Purpose and honest status

ADR-0004 is **Accepted (provisional)**: spike #1 resolved every risk that could be resolved
with machine-checked evidence, and left seven checks (C1–C7) that intrinsically need physical
hardware. This document turns those seven lines into an actionable device test plan **against
the app as it exists today** — which has moved since the spike scaffold — and adds the
device-bound part of the headless action layer (REQ-039). Everything here is *external
handback*: it needs real devices and EAS builds; the final section states exactly what CI can
never verify and why.

Two reality updates since the spike change what "pass" means:

- **The client is online-only** ([ADR-0049](../adr/0049-abandon-offline-first-architecture.md)
  superseded the offline-first line). C4's original wording — airplane-mode edits converging
  through the sync engine — tests an architecture the client no longer has. C4 below is
  restated to test the *current* contract: honest offline behaviour and clean recovery, not
  offline data convergence.
- **Native persistence for the timer session is not wired yet.**
  [`apps/mobile/src/timer/timerStore.ts`](../../apps/mobile/src/timer/timerStore.ts) persists
  the client-only session slice (banked total + paused context) to `localStorage` on web and
  explicitly **falls back to an in-memory value on native** "until a durable native store
  (AsyncStorage) is wired". The *server* remains authoritative for the running segment
  ([`reconcile.ts`](../../apps/mobile/src/timer/reconcile.ts)), so a plain running timer
  survives restart via the API — but the banked/paused local slice does not on native. **C1/C2
  will partially fail on native today by construction**; wiring AsyncStorage is a known code
  prerequisite of this checklist, not a device discovery.

Device matrix (from the spike): **one iOS device, one mid-range Android device, two desktop
browsers (Chrome + Safari or Firefox)**, running a real build (EAS dev-client or production
profile) against a reachable API (`EXPO_PUBLIC_API_URL` set — without it the app is the demo
path, ADR-0049, and nothing below is meaningful).

## The procedures

### C1 — Timer survives force-quit

- **Device:** iOS + Android.
- **Steps:** (1) Sign in, start a timer on Today; note the wall-clock time. (2) Wait ≥2 min.
  (3) Force-quit the app (swipe away / recents kill). (4) Wait ≥3 min. (5) Reopen.
- **Pass:** the timer shows running with elapsed ≈ wall-clock difference (±2 s); pausing then
  force-quitting and reopening restores the paused state with the banked total intact
  (this second half is the AsyncStorage-dependent part — see status note above).
- **Fallback trigger:** elapsed is wrong by more than seconds after the persistence gap is
  closed — that would contradict spike Q1's derive-from-epoch design and is a C1 core failure
  (Flutter-fallback class per ADR-0004).

### C2 — Timer survives a hard device reboot

- **Device:** iOS + Android.
- **Steps:** as C1, but step 3 is a full power-off/power-on of the device.
- **Pass:** same criteria as C1. The server-authoritative running entry must be re-fetched and
  reconciled on cold start (`reconcileTimer` in `reconcile.ts`).
- **Fallback trigger:** OS-level storage does not return the persisted session, or reconcile
  produces a wrong total — core failure class.

### C3 — Backgrounded timer stays visible (Live Activity / foreground notification)

- **Device:** iOS (Live Activity) + Android (foreground-service notification).
- **Steps:** start a timer, background the app for ≥30 min of normal phone use.
- **Pass:** an ongoing surface shows the running timer the whole time; the process is not
  killed silently; elapsed is correct on return.
- **Honest status:** **cannot pass today** — no Live Activity / foreground-service module
  exists in `apps/mobile` (no notification/foreground code ships; the spike wired only a
  stand-in local notification in the scaffold). This check gates on building that native-edge
  module (budgeted in ADR-0004 as edge work), which itself needs a dev-client build — Expo Go
  cannot load it (same constraint documented for the native usage module in
  [`apps/mobile/native/mydevtime-usage/README.md`](../../apps/mobile/native/mydevtime-usage/README.md)).
- **Fallback trigger:** the OS kills the timer despite the proper foreground surface.

### C4 — Offline behaviour is honest and recovery is clean (restated for ADR-0049)

- **Device:** iOS + Android.
- **Steps:** (1) with a timer running, enable airplane mode; (2) navigate the app, attempt an
  edit; (3) disable airplane mode.
- **Pass:** the app does not crash or silently pretend writes succeeded; failed mutations
  surface as errors (TanStack Query, ADR-0047); after reconnect, data refetches and the
  running timer's elapsed is still wall-clock-correct (it is derived, not ticked).
- **Not tested (removed with the architecture):** offline queuing/convergence — ADR-0049 made
  the client online-only; the dormant conflict engine in `packages/domain` is out of scope.
- **Fallback trigger:** none — a failure here is a bug, not an ADR-0004 architecture signal.

### C5 — Keyboard-only dashboard on web

- **Device:** two desktop browsers.
- **Steps:** using only the keyboard, on a workspace with ~50 entries: add, edit, save,
  delete, and search entries on the Today/entries surface.
- **Pass:** every step completes without a pointer; no focus traps; scroll behaviour of the
  long list is acceptable.
- **Fallback trigger:** an interaction that *cannot* be reached by keyboard at all in
  react-native-web (none is expected — RNW renders real DOM; see also the
  [a11y spike](../spikes/0003-web-a11y-semantic-html.md), which found the remaining gap to be
  structure, not operability).

### C6 — Tab order + focus ring in two browsers

- **Device:** Chrome + Safari/Firefox.
- **Steps:** tab through sign-in and Today; open and close a drawer/dialog.
- **Pass:** visible focus ring on interactive elements, logical order, focus moves into and
  restores out of modals. Note: this overlaps the REQ-043 remainder tracked in #263 (per the
  a11y spike) — a failure here is a known, in-plan fix, not an ADR-0004 trigger.

### C7 — Day Canvas / Planner gestures at ~60fps on mid-range Android

- **Device:** a mid-range Android phone (the spike's explicit bar), release-mode build (JS
  perf in debug builds is not representative).
- **Steps:** on the Planner day view, drag, stretch, and split blocks continuously for ≥60 s
  with the GPU profiling HUD or `adb shell dumpsys gfxinfo` sampling.
- **Pass:** sustained ≈60fps, no visible stutter while the gesture is active (gesture math
  runs in Reanimated worklets on the UI thread — the pattern validated by spike Q4 and already
  used for the clock, [ADR-0041](../adr/0041-reanimated-ui-thread-timer.md)).
- **Fallback trigger:** sustained jank that cannot be fixed at the native edge — this is the
  strongest remaining Flutter-fallback class check.

**Sign-off:** when C1–C7 pass, drop "provisional" from ADR-0004's status (that PR cites this
document with per-check results, device models, and OS versions). A core failure on C1–C3 or
C7 that cannot be resolved at the edge supersedes ADR-0004, never edits it.

## Headless action layer (REQ-039) — what exists, what maps, what needs a device

REQ-039 ([#49](https://github.com/NexusHero/myDevTime/issues/49), framed in
[ADR-0013](../adr/0013-competitive-adoption-round-2.md)) is iOS App Intents
(Siri/Shortcuts/Spotlight) + an Android Quick Settings Tile over **one shared headless action
layer** — the gateway to widgets/watch.

### Deep-link routes that exist today

The route table is pure data in
[`packages/design/src/nav.ts`](../../packages/design/src/nav.ts) (`ROUTES`, with
`buildPath`/`parsePath`), mirrored 1:1 by Expo Router files under
[`apps/mobile/app/`](../../apps/mobile/app/_layout.tsx) (ADR-0045), under the app scheme
**`mydevtime`** ([`app.json`](../../apps/mobile/app.json)) — e.g.
`mydevtime:///today` on native, path URLs on web:

| Screen | Path |
|---|---|
| today | `/today` |
| planner | `/planner` |
| projects / project | `/projects`, `/projects/:projectId` |
| task | `/tasks/:taskId` |
| reports | `/reports` |
| meetings / meeting | `/meetings`, `/meetings/:meetingId` |
| profile | `/profile` |
| worktime / absences / settings / credits / rates / rules | `/profile/worktime`, `/profile/absences`, `/profile/settings`, `/profile/credits`, `/profile/rates`, `/profile/rules` |
| assistant | `/assistant` |

### How OS quick actions map onto them

Navigation-shaped actions map directly to existing routes: **Open Today** → `/today`,
**Plan my day** → `/planner`, **Ask the assistant** → `/assistant`, **Work time / clock
screen** → `/profile/worktime`. A home-screen long-press quick action or a Shortcut that
opens a URL needs nothing beyond these routes plus registering the actions.

The actions that make REQ-039 valuable — **start/stop timer**, **clock in/out** — are *not*
navigations: they must execute without opening UI (that is the "headless" in the requirement,
and it is offline-tolerant by REQ-039's wording). Today no such layer exists in the repo:
there is **no quick-actions/App-Intents/Tile package in
[`apps/mobile/package.json`](../../apps/mobile/package.json)** (only `expo-linking`, used for
outbound URLs), and no headless action module in the source. The building blocks it would
call do exist — `startTimer`/`stopTimer` in
[`apps/mobile/src/api/timer.ts`](../../apps/mobile/src/api/timer.ts) and the persisted
session in `timerStore.ts` — so the remaining design is a small action module (e.g.
`runAction('timer.start' | 'timer.stop' | 'clock.in' | 'clock.out')`) invoked from the native
surfaces, with a deep link as the visible fallback (`/today` after a started timer).

### What requires a real EAS build / device (the handback)

- **iOS App Intents / Siri / Shortcuts and any Live Activity**: native Swift targets +
  entitlements, only buildable with an Apple Developer account through EAS; not loadable in
  Expo Go, not runnable in CI.
- **Android Quick Settings Tile / home-screen quick actions**: a native `TileService` /
  manifest entries via config plugin — same dev-client constraint.
- **Verifying the mapping end-to-end**: invoking a Shortcut/Tile with the app killed, in
  airplane mode, and confirming the action queues or fails honestly — device-only by nature.

## What CANNOT be verified in CI, and why

| Item | Why CI cannot verify it |
|---|---|
| C1/C2 hard force-quit & reboot | No emulator step in CI performs a real OS reboot; storage semantics after power loss are hardware behaviour |
| C3 Live Activity / foreground service | Needs native modules that Expo Go and the Vitest/jsdom test stack cannot load (ADR-0027 scopes component tests to render logic; the Reanimated/native runtime is explicitly a device concern) |
| C7 sustained frame rate | Frame pacing on mid-range hardware is unmeasurable in jsdom/emulators-on-shared-CI; debug builds are not representative |
| App Intents / Siri / Tile invocation | OS-level integration surfaces with no headless test harness; require signed builds and physical interaction |
| Store entitlements (mic, notifications, background modes) | Granted/exercised only on real builds with real provisioning |

CI *does* hold everything else: the pure logic these behaviours rest on (elapsed derivation,
reconcile, route build/parse in `nav.ts`) is unit-tested under the coverage bar, which is
exactly the split spike #1 engineered.

## Update (2026-07 · #12 residual) — native persistence seam now wired

The C1/C2 status note above (native session persistence "not wired yet") is now
**superseded by code**. A cross-platform key-value seam
[`apps/mobile/src/timer/kvStorage.ts`](../../apps/mobile/src/timer/kvStorage.ts) exposes a
narrow `KvStorage` (`get`/`set`/`remove`) whose resolver prefers `localStorage` on web, then a
guarded `require` of **`@react-native-async-storage/async-storage`** (now a dependency in
`apps/mobile/package.json`, installed) on native, and only falls back to an explicit in-memory
`Map` when neither is available.
[`timerStore.ts`](../../apps/mobile/src/timer/timerStore.ts) persists the banked/paused session
slice through this seam (hydrate-once on start into a sync cache; sync writes fire-and-forget),
with no change to its public API. So on native the banked total + paused context are now written
to AsyncStorage and rehydrated on cold start — the AsyncStorage-dependent half of C1 (paused
state + banked total surviving force-quit) and C2 (surviving reboot) are no longer failing "by
construction". What remains is **device-verify-only**: confirming AsyncStorage actually persists
and returns the slice across a real force-quit and a real power-off/power-on on physical iOS and
Android hardware (jsdom/emulator storage semantics are not representative of post-power-loss
behaviour), per the C1/C2 pass criteria above.
