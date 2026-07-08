# Spike #1 — React Native + Expo for iOS / Android / Web

Throwaway spike that validates (or overturns) **[ADR-0004](../../docs/adr/0004-react-native-expo-client.md)**
before any client code lands in `apps/mobile`. It answers the four riskiest
questions from [issue #1](https://github.com/NexusHero/myDevTime/issues/1) (Q4 added by ADR-0011):

| # | Question | Proof surface | Pure core (machine-tested) |
|---|----------|---------------|----------------------------|
| Q1 | Does a running timer survive background / kill / **reboot**? | `src/timer/TimerScreen.tsx` | `src/timer/elapsed.ts` |
| Q2 | Offline-first local persistence with a clean path to the sync engine? | `src/offline/db.ts` (expo-sqlite) | `src/offline/outbox.ts` |
| Q3 | Is a keyboard-first web dashboard achievable at quality on react-native-web? | `src/dashboard/EntriesDashboard.tsx` | `src/dashboard/keymap.ts` |
| Q4 | Day Canvas drag/stretch/split at 60fps? | `src/canvas/DayCanvas.tsx` (Reanimated) | `src/canvas/layout.ts` |

> **Not part of the pnpm workspace** (see `pnpm-workspace.yaml`) and excluded from
> the repo's docs gate — it is a disposable prototype with its own toolchain, per
> the `spikes/ui-prototype` precedent.

## The two halves

**Correctness-critical logic is pure and platform-independent** (`src/**/*.ts`, no
React Native imports): timer-elapsed math, offline→sync mapping, the keyboard
model, and the canvas geometry. These are unit-tested and typechecked in this
repo's Node toolchain with **no device and no native build** — that is the
evidence the findings cite.

**The RN/Expo files are a thin, human-runnable shell** over those cores
(`App.tsx`, `src/**/*.tsx`, `src/**/db.ts|persist.ts`). They need real hardware to
judge feel and fps, which a headless environment cannot do.

## Machine verification (no device needed)

```bash
# from this directory — reuses the repo's already-installed typescript + vitest
npm run verify        # = verify:types + verify:test
```

- `verify:types` → `tsc -p tsconfig.verify.json` typechecks the four pure cores
  under `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.
- `verify:test` → `vitest run` executes the core test suites (23 tests).

Latest run: **tsc 0 errors · 4 files · 23 tests passed.**

## Running the real app (device / browser)

```bash
npm install
npx expo install          # aligns native module versions to the Expo SDK
npx expo start            # press i / a for simulators, w for web
```

Then walk the **on-device checklist** in
[`docs/spikes/0001-client-rn-expo.md`](../../docs/spikes/0001-client-rn-expo.md)
on one iOS device, one Android device, and two desktop browsers. That checklist
is the remaining gate on flipping ADR-0004 from *provisionally Accepted* to fully
signed off.
