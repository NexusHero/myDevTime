# ADR 0041: UI-thread stopwatch via react-native-reanimated

## Status

Accepted (owner decision) — introduces `react-native-reanimated` to `apps/mobile`. Realizes the one
sound performance idea from the review of PR #173 (the "Reanimated timer"); the other #173 changes
were rejected or deferred (SQL aggregation contradicts ADR-0005; FlashList on the bounded
`ProjectsScreen` fights ADR-0035 — see that review).

> Numbering note: 0037–0040 are in-flight on other open PRs (#172/#173 and the offline-store ADR);
> this decision takes 0041 to avoid a collision.

## Context

The live stopwatch shown in the Today hero and the persistent Island was driven by a
`setInterval` in `useTimer` that called `setState` once a second. Every tick re-rendered React —
and because the timer is shared via context, it re-rendered the whole Today screen (and the Island
on other screens) 60 times a minute, forever, while a timer ran. This is the classic RN performance
smell: a 1 Hz display driving continuous React reconciliation.

## Decision

Adopt **`react-native-reanimated`** for the ticking clock **only**, as a display component:

- **`ReanimatedTimer`** renders a read-only `AnimatedTextInput` whose text is computed on the **UI
  thread** from `startedAt` + `accumulatedMs`. The seconds advance with **zero** React re-renders —
  the JS thread is never touched while the timer runs.
- **`useTimer` stops re-rendering for display.** The per-second `setInterval`/`setNowMs` tick is
  removed; the hook exposes the raw inputs (`running.startedAt`, `accumulatedMs`) and a one-shot
  `elapsed` snapshot for the idle/paused states. The **source of truth stays in `useTimer`** (segment
  start + banked ms); the deterministic `formatStopwatch` still formats the non-animated snapshot, so
  no math moves into the view (ADR-0005 unaffected — this is presentation only).
- **Scope is the clock.** `ReanimatedTimer` is used only while a segment actually runs (Today hero +
  Island); idle/paused render the plain snapshot.
- **Tests:** `react-native-reanimated` needs the native/worklet runtime jsdom lacks, so Vitest
  aliases it to a minimal shim (`test/__mocks__/react-native-reanimated.tsx`) that evaluates the
  derived worklet once — enough for render assertions; UI-thread ticking is a device concern
  (ADR-0027). The Babel `react-native-reanimated/plugin` is added for the app build.

## Consequences

- No React re-renders while a timer runs — the Today screen and Island stop reconciling once a
  second. The most-shown, longest-lived animation in the app is now free.
- New runtime dependency (`react-native-reanimated`) and its Babel plugin; standard in the Expo/RN
  ecosystem and already anticipated by the app scaffold.
- The HH:MM:SS formatting is duplicated as a worklet (`formatWorklet`) because worklets cannot call
  the JS-thread `formatStopwatch`. The two are trivial mirrors; a divergence would be cosmetic
  (never a stored/billed number), but they must be kept in sync.
- Reanimated is now available for future UI-thread animations (gestures, the Day Canvas), should they
  be needed.

## Alternatives considered

- **Keep the `setInterval` + `setState` tick:** rejected — it is exactly the per-second whole-screen
  re-render we are removing.
- **`requestAnimationFrame` in JS:** rejected — still re-renders on the JS thread; Reanimated moves
  the work off it entirely.
- **Adopt the whole #173 performance PR:** rejected — it bundles the offline-SQLite base plus an SQL
  aggregation that violates ADR-0005 and a FlashList change that fights ADR-0035; only the Reanimated
  idea is sound, so it is cherry-picked here. (SQLite indexes go into the offline-store slice #175.)
