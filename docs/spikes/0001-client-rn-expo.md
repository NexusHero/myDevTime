# Spike #1 findings — React Native + Expo for iOS / Android / Web

**Issue:** [#1](https://github.com/NexusHero/myDevTime/issues/1) · **Decides:**
[ADR-0004](../adr/0004-react-native-expo-client.md) · **Milestone:** M0 ·
**Scaffold:** [`spikes/client-rn-expo`](../../spikes/client-rn-expo/README.md)

## Verdict — **GO (provisional)** on React Native + Expo

The architecture-, logic-, and web-target risks that this ADR was gated on are
**resolved with machine-checked evidence**. The two risks that intrinsically need
physical hardware — a real reboot surviving the timer, and 60fps on a mid-range
device — are addressed by a scaffold plus established platform evidence, and are
carried as a **residual on-device checklist** (below) that a human signs off
before the "provisional" qualifier is removed. Flutter (the named fallback) is
**not** triggered: none of the four questions produced a blocker.

This mirrors how the decision was framed — a go/no-go backed by evidence, not
preference. The evidence for the half that can be checked without a device is
reproducible in CI; the other half is a short, explicit manual pass.

### How to reproduce the machine evidence

```bash
cd spikes/client-rn-expo && npm run verify
# tsc -p tsconfig.verify.json   → 0 errors (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess)
# vitest run                    → 4 files, 23 tests passed
```

The load-bearing logic for every question is a **pure, platform-independent
module** (`src/**/*.ts`, no React Native imports); the RN/Expo files are a thin
shell over it. That split is deliberate: it puts the parts that can be wrong under
deterministic test, and confines "needs a device to judge" to feel and frame rate.

---

## Q1 — Timer reliability across background / kill / reboot

**Finding: solvable, and not actually a platform question.** The reliable design
never counts ticks. The timer's entire state is two numbers — `startedAt` (epoch
ms of the running segment) and `accumulatedMs` (closed segments) — persisted
synchronously on every start/pause. Elapsed time is always *derived* from the wall
clock: `accumulated + (now − startedAt)`. A backgrounded, killed, or rebooted app
re-reads those two numbers on cold start and recomputes against `Date.now()`; the
per-second UI tick is cosmetic and correctness never depends on it firing.

- **Machine-verified** (`src/timer/elapsed.ts`, `elapsed.test.ts`): elapsed counts
  a full 3-hour background gap and a 24-hour reboot gap exactly; rehydrating the
  JSON-persisted state is identity; pause/resume accumulates; a backwards clock
  (NTP correction) never shrinks the total. 8 tests.
- **Needs a device** (checklist C1–C3): that the OS actually returns the persisted
  value after a *hard* reboot, and that the foreground surface (iOS Live Activity /
  Android foreground-service notification) keeps the timer visible and un-killed.
  The scaffold wires a local notification as a stand-in; a production build needs
  the native module.

**Platform evidence:** Expo's `expo-sqlite`/`AsyncStorage` persist synchronously;
iOS Live Activities and Android foreground services are the documented surfaces
for an ongoing timer and are reachable from RN via config plugins / small native
modules — budgeted in ADR-0004 as edge work, not a fork trigger.

## Q2 — Offline-first persistence with a clean path to the sync engine

**Finding: clean fit.** The client writes every mutation to the local
`expo-sqlite` table **and** an outbox in one transaction, so the UI is instant and
fully functional offline. When connectivity returns, the outbox flushes as a batch
of `EntityState` snapshots — the *exact* shape the already-built deterministic sync
engine (`packages/domain`, REQ-006 / [ADR-0019](../adr/0019-sync-protocol.md))
consumes via `applyPush`.

- **Machine-verified** (`src/offline/outbox.ts`, `outbox.test.ts`): offline edits
  stamp last-writer-wins metadata (`updatedAt`, `deviceId`); repeated edits to one
  entity coalesce to a single latest snapshot with merged fields (one row per
  entity on flush, not a replay log); tombstones sync like any change; ack drops
  flushed rows. 5 tests. The `EntityState` type here is a structural mirror of the
  domain type, so the mapping is literally the engine's input.
- **Needs a device** (checklist C4): a real airplane-mode → edit → reconnect →
  converge round-trip against the running API.

**Workspace isolation** holds by construction: the repo API
(`src/offline/db.ts`) takes `workspaceId` non-optionally, same rule as the server.

## Q3 — Keyboard-first dashboard on react-native-web

**Finding: achievable.** react-native-web renders to the **real DOM**, so
`onKeyDown` carries genuine keyboard events (this is the concrete advantage over
Flutter Web's DOM-less canvas that ADR-0004 called out). The interaction model is
a pure resolver, not view-embedded conditionals.

- **Machine-verified** (`src/dashboard/keymap.ts`, `keymap.test.ts`): `j/k` +
  arrows move the row cursor, `n` adds, `e`/`Enter` edits, `⌘/Ctrl+Enter` and
  `Enter` save, `Shift+Enter` inserts a newline, `Esc` cancels, `/` opens search;
  editing mode passes text keys through untouched; focus clamps without wrapping.
  10 tests. `EntriesDashboard.tsx` attaches a document-level key listener on web
  and the same screen degrades to touch on native.
- **Needs a browser** (checklist C5–C6): visual/scroll quality of a longer table
  and tab-order/focus-ring accessibility in two desktop browsers.

## Q4 — Day Canvas drag / stretch / split at 60fps (ADR-0011)

**Finding: no blocker; the design keeps gesture math off the JS thread.** The Day
Canvas ([ux-vision §2.1](../design/ux-vision.md)) is the hardest UI in the app.
The 60fps bar is met by running per-frame gesture math in **`react-native-reanimated`
worklets on the UI thread**, so dragging never round-trips to JS. Worklets forbid
closures over JS-thread state, which forces the math to be pure functions of
numbers — so the geometry is testable in isolation and reused verbatim by the
worklet.

- **Machine-verified** (`src/canvas/layout.ts`, `layout.test.ts`): grid snapping;
  move preserves duration and keeps the block in-bounds; resize respects a minimum
  duration and cannot cross the opposite edge; **split conserves total duration
  exactly** and refuses a cut that would make either half too small; overlap
  detection. 6 tests. `DayCanvas.tsx` drives draggable blocks through a `Pan`
  gesture whose `onUpdate`/`onEnd` are worklets calling the same `snap()`.
- **Needs a device** (checklist C7): the actual sustained frame rate while dragging
  on a mid-range Android, which no headless check can measure.

**Platform evidence:** Reanimated + Gesture Handler are the standard, widely-shipped
RN stack for exactly this (UI-thread-driven direct manipulation); the risk was
never "can it be built" but "does it *feel* right at 60fps," which C7 settles.

---

## Residual on-device checklist (the remaining gate)

Run the scaffold (`npx expo start`) on **one iOS device, one Android device, and
two desktop browsers** and confirm:

| # | Check | Q |
|---|-------|---|
| C1 | Start a timer, force-quit the app, reopen → elapsed is correct | Q1 |
| C2 | Start a timer, **reboot the device**, reopen → elapsed is correct | Q1 |
| C3 | Backgrounded timer stays visible via Live Activity (iOS) / foreground notification (Android) | Q1 |
| C4 | Airplane-mode edits, reconnect → entries converge with the API, no dup/loss | Q2 |
| C5 | Keyboard-only: add/edit/save/delete/search a 50-row table, no mouse | Q3 |
| C6 | Tab order + focus ring are correct in two browsers (Chrome + Safari/Firefox) | Q3 |
| C7 | Drag/stretch/split blocks on a mid-range Android holds ~60fps | Q4 |

When C1–C7 pass, drop "provisional" from ADR-0004's status. If any of C1–C4 or C7
**fails and cannot be resolved at the edge**, that is a Flutter-fallback trigger and
ADR-0004 is superseded, not edited (per the ADR process).

## What this spike did *not* cover (out of scope, tracked elsewhere)

- EAS build/store submission pipeline — a later M0/M1 concern, not a go/no-go input.
- Widgets / watch complications — ADR-0004 already budgets these as native-edge work.
- Meeting capture / ASR — separate decision frame (spike #31, ADR-0009).
