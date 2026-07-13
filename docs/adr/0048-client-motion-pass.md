# ADR 0048: Client motion pass (design v4) — reduced-motion-first animation

## Status

Accepted (owner decision) — realizes the design system's **v4 motion pass**
(`docs/design-system/`, delivered handoff) in `apps/mobile`. Bound by
[ADR-0005](0005-deterministic-core-llm-assist.md) (the numbers stay the
deterministic core's — animation only *interpolates* toward them, never
computes them) and [ADR-0027](0027-mobile-ui-testing-strategy.md) (on-device
motion is verified outside the vitest gate). Extends [ADR-0004](0004-react-native-expo-client.md).

## Context

The design system's v4 handoff added a **motion / micro-interaction pass**: the
instruments animate in on mount (BudgetRing draws in + counts up, OvertimeGauge
grows out of zero, WeekSparkline grows from the baseline, Heatmap reveals as a
wave, LeaveBalance segments grow), the Today tracker's live button breathes and
emits pulse waves, the Island's live dot pulses, and — a behaviour change, not
just decoration — the momentary **MoodCheck** stops being a standing Today widget
and appears only in the punch-out moment as a transient one-tap row.

The reference implementation is web (CSS `@keyframes` + `requestAnimationFrame`
count-ups). React Native has no CSS, so the pass has to be **ported**, not copied.
Two forces shaped the decision:

- The client already ships `react-native-reanimated` (the UI-thread stopwatch,
  [ADR-0041](0041-reanimated-ui-thread-timer.md)) — an animation runtime is
  present, not a new dependency.
- Every animated number that a user reads (budget %, overtime hours) is a
  deterministic-core value (ADR-0005). Animation must never *become* the source
  of that number; it may only ease a display toward it.

## Decision

1. **The easing curve is pure and lives in `packages/design`** (`motion.ts`:
   `clamp01`, `easeOutCubic`, `easeTo`), held to the ≥90 % coverage bar. It is the
   same `1 − (1 − p)³` the web instruments use, so native and web animate
   identically. The client owns only the wiring, never the curve.

2. **Mount animations (count-ups, draw-ins) use one client primitive,
   `useMountValue(target, durationMs)`** — a `requestAnimationFrame` loop that
   eases 0 → `target` via `easeTo`. This mirrors the web instruments (rAF + eased
   progress), works on native and web, and needs no new reanimated surface.
   Instruments read the animated value into the *same* geometry helpers
   (`ringDashOffset`, `gaugeAngle`, `sparklinePoints`) — tone/sign stay fixed by
   the real value so colours never flip mid-animation.

3. **Infinite/looping motion (Island live-dot pulse, LiveButton breathing +
   pulse waves) uses reanimated** (`withRepeat`/`withTiming` + `useAnimatedStyle`)
   — the right tool for continuous UI-thread loops. These are wrappers
   (`LiveButton`) or self-contained sub-components (`LiveDot`) so the underlying
   button/timer logic and touch targets are untouched.

4. **Reduced-motion is first-class and gates everything.** Both primitives read
   the OS setting via reanimated's `useReducedMotion()`: when the user opts out,
   `useMountValue` returns its target on the first frame (no animation) and the
   loops never start. Motion is a progressive enhancement, never a correctness or
   accessibility dependency (ux-vision §4).

5. **MoodCheck is repurposed** from a five-emoji standing row to the punch-out
   transient prompt (Gut / Angespannt / Gestresst + skip, self-dismissing
   acknowledgement). Today only mounts it in the punch-out moment. This matches
   the design readme's OLBI/EMA rationale (momentary self-report, never modal,
   never a permanent nag).

## Consequences

- **Testing.** The render-test reanimated shim
  (`test/__mocks__/react-native-reanimated`) reports reduced-motion **ON**, so
  every animated instrument renders at its final/rest state — component
  assertions see real values (e.g. `62%`), never a mid-animation frame, and the
  loops never mount. New tests cover the pure easing (`motion.test.ts`), the
  primitive's rest state (`useMountValue.test.tsx`), the instrument rest state
  (`BudgetRing.test.tsx`), and the MoodCheck punch-out behaviour
  (`MoodCheck.test.tsx`). On-device motion (the actual frames) stays outside the
  gate per ADR-0027.

- **Determinism preserved (ADR-0005).** Animated values are display-only eases
  toward a core value; accessibility labels report the true value, not the
  animating one; over-budget rings still clamp the arc while the label shows the
  real percentage.

- **Scope.** This ports the visible v4 motion. Not every web keyframe is
  reproduced 1:1 (e.g. the Reports section-rise stagger and the pause-button
  waves are follow-up polish); the primitives (`useMountValue`, `LiveButton`)
  make those cheap to add later.

- **No new dependency.** Reanimated was already present; `packages/design` gains
  three pure functions.
