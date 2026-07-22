# ADR-0073 — New-Architecture migration (React 19 / RN ≥ 0.81 / Reanimated 4 / gesture-handler 3)

- **Status:** Proposed
- **Date:** 2026-07-22
- **Deciders:** NexusHero
- **Related:** ADR-0004 (RN + Expo + react-native-web, "one codebase incl. web"), ADR-0048 (motion),
  issue #357 (gesture-handler v3 breaks react-native-web), PR #355 (holds gesture-handler at v2)

## Context

Dependabot proposed bumping `react-native-gesture-handler` 2.20.2 → 3.1.0. It **blanks the
web app** at render (`TypeError: l is not a function` inside react-dom's commit phase; every
browser-acceptance journey times out). PR #355 pinned gesture-handler back to `~2.20.2`; #357
traced the root cause.

The root cause is **not our code**. gesture-handler v3 is the leading edge of an ecosystem move:
the animation/gesture stack (gesture-handler 3, Reanimated 4) is now **New-Architecture-only** and
was rebuilt around **Worklets**, dropping the old-architecture / react-native-web backends.

Facts established (sources in #357 and below):

- **gesture-handler v3.0** removed old-architecture ("paper") support; **minimum React Native 0.82**;
  removed the web gesture backend deps (`@egjs/hammerjs`, `prop-types`, `hoist-non-react-statics`);
  new hook-based API + deeper Reanimated 4 integration.
  <https://github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.0.0>
- **Reanimated 4** is New-Architecture-only, requires the separate **`react-native-worklets`**
  package (Babel plugin swap `reanimated/plugin` → `worklets/plugin`), and effectively **requires
  React 19** (RN ≥ 0.78). It supports react-native-web, but on web it runs as **plain JS** and
  **worklets are inert** (the browser is single-threaded).
  <https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/>
- **react-native-web has no Fabric and never will.** It is a DOM/JS renderer in **maintenance mode**;
  the maintainer is steering toward `react-strict-dom`. Enabling the New Architecture helps only
  native — it cannot help the web target.
  <https://github.com/necolas/react-native-web/discussions/2816>
- **Expo SDK train:** SDK 52 = RN 0.76 / React 18.3 (us). SDK 53 = RN 0.79 / React 19. SDK 54 =
  RN 0.81 / React 19.1 (**last SDK with legacy-architecture support**). SDK 55 = RN 0.83, **New-Arch
  only** (`newArchEnabled` removed from app.json).
  <https://expo.dev/changelog/sdk-54> · <https://expo.dev/changelog/sdk-55>

Our stack today: Expo ~52 · RN 0.76.5 · **React 18.3.1 (pinned)** · reanimated 3.16.7 ·
gesture-handler 2.20.2 (`legacy`) · flash-list 2.3.2. `newArchEnabled: true` is already set, so
**native iOS/Android already run Fabric.**

### What actually uses this stack (grounded in the code)

- **Gestures (gesture-handler):** exactly **one** site — `PlannerScreen`: drag a week-canvas block
  to **move** it, drag its edge to **resize** (duration). Nothing else in the app uses gestures.
- **Animations (reanimated):** Island (timer-pill pulse/breathing), mascots Blocky & Sevi,
  BrandSplash, LiveMark (living logo dot), ReanimatedTimer, mount transitions. The data instruments
  (BudgetRing/Gauge/Sparkline/Heatmap) animate via **pure easing math + SVG**, not reanimated — they
  are untouched by this decision.
- **Backend:** untouched. NestJS API, `packages/domain`, Postgres/Drizzle, AI layer, billing have
  **zero** dependency on the RN architecture.

## The crux

Upgrading to gesture-handler v3 / Reanimated 4 **does not benefit the web target and likely harms
it**, because worklet-driven gestures are inert on react-native-web. The only concrete v3 win is
**native-only**, and native already works on gesture-handler v2. So for a web-inclusive product,
v2 is currently the *better* choice, not a backlog.

The ecosystem, however, is forcing the train: **SDK 54 is the last legacy-supporting SDK; SDK 55 is
New-Arch-only.** We will have to migrate the native side eventually to stay on supported Expo/RN.

### Concrete target versions (read from Expo SDK 54's `bundledNativeModules.json`, offline)

| Package | Today (SDK 52) | SDK 54 target | Note |
|---|---|---|---|
| react / react-dom | 18.3.1 | **19.1.0** | React 19 |
| react-native | 0.76.5 | **0.81.5** | still < 0.82 |
| react-native-reanimated | 3.16.7 | **~4.1.1** | + `react-native-worklets` 0.5.1, Babel plugin swap |
| **react-native-gesture-handler** | 2.20.2 | **~2.28.0** | **still v2** — SDK 54 does *not* ship v3 |
| @shopify/flash-list | 2.3.2 | 2.0.2 | already aligned |
| react-native-web | (transitive) | ~0.21.0 | still maintenance-mode DOM renderer |
| expo-router | 4.x | ~6.0.24 | major bump |

**Key consequence:** gesture-handler **v3 requires RN ≥ 0.82, which first ships in Expo SDK 55**
(RN 0.83). SDK 54 keeps gesture-handler on **2.28** — i.e. the web gesture backend is *retained*.
So the realistic, web-safe intermediate is **SDK 54 (React 19 + Reanimated 4, gesture-handler stays
2.x)**; gesture-handler v3 is a *separate, later* jump to SDK 55 that reintroduces exactly the web
problem from #357. This reframes "the v3 changeover" as **two SDK jumps**, and argues for stopping
at SDK 54 unless/until we have a web gesture answer.

### Environment note (why this ADR isn't also the finished migration)

Attempted in the CCR sandbox on branch `chore/rn-new-arch-migration`: `expo install --fix` **fails**
because the Expo API (`api.expo.dev`) is **not reachable** under the sandbox network policy
(`Host not in allowlist`), so the SDK-54 version alignment can't be automated here; and native
iOS/Android builds can't be produced/validated in this environment at all (no Xcode/Android SDK).
The full migration therefore must run in a dev environment with Expo API access + EAS/simulators.
This ADR carries the plan and the exact target versions so that work is turn-key there.

## Options

### A — Stay put (React 18 / RN 0.76 / reanimated 3 / gesture-handler 2)
- **Wins:** everything works today, incl. web; zero effort; zero risk.
- **Losses:** we fall behind the SDK train; more libraries go New-Arch-only over time; deferred (not
  lost) access to future native-only libs. No user-visible feature loss.

### B — Full New-Architecture migration now (this ADR's "umstellen")
Expo 52 → 54(+), RN 0.76 → 0.81(+), **React 18 → 19**, reanimated 3 → 4 (+ `react-native-worklets`,
Babel plugin swap), gesture-handler 2 → 3 (hook API + `onStart/onEnd` → `onActivate/onDeactivate`,
`success` → `canceled`), testing libs → React 19 (react-test-renderer 19 / @testing-library/react-native 14).
- **Wins:** native fully current (reanimated 4 CSS-animation API + perf headroom; gesture-handler 3);
  the held-back React-19 test libs get unblocked; flash-list v2 (already in) is aligned; future
  New-Arch-only libs become adoptable on native.
- **Losses / risks:**
  - **Web is the casualty.** gesture-handler v3 gestures on react-native-web are, at best,
    second-class (worklets inert). Concretely: **PlannerScreen drag-to-move / drag-to-resize on web**
    ranges from "laggier/different" to "must be disabled on web." If disabled, the *capability*
    survives via the typed **"+ New" dialog / block drawer** (edit time/duration by typing); the
    *direct-manipulation gesture* is what's lost on web. Native keeps the drag.
  - Large, high-regression migration: React 19 breaking changes, reanimated hard cutover
    (3 and worklets cannot coexist), native rebuilds (not verifiable in CI here), test rewrites,
    RN 0.79 `package.json` exports enforcement (deep imports may break).
  - **Does not solve #357's web problem** — it changes the failure mode, it doesn't remove it,
    because react-native-web still has no worklet thread.

### C — Migrate native, keep web deliberately reduced
Take the train (Option B on native), but **platform-gate gesture features off web** (`.web.tsx` /
`Platform.OS === 'web'` → the Planner block editor falls back to the typed dialog on web). Longer
term, treat web either as a first-class-but-reduced target or migrate it toward `react-strict-dom`.
- **Wins:** native modern + supported; web stays alive with an honest, typed fallback for the one
  gesture surface; no dependency on react-native-web ever gaining Fabric.
- **Losses:** web loses drag-to-move/resize on the Planner (typed fallback remains); still a large
  migration; commits us to a two-tier interaction model (gesture native, typed web) for that screen.

## Decision (proposed)

Execute the migration on a **branch, in phases, never flipping `main` to a broken state**, and
adopt **Option C** as the end shape: migrate the native New-Architecture stack **but keep the
web target working by gating the Planner drag/resize gesture off web behind the existing typed
"+ New" dialog / block drawer.** gesture-handler v3 / Reanimated 4 land for native; web keeps
gesture-handler on the legacy path or drops the gesture on web — decided empirically by the Phase 1
spike below.

Rationale: it is the only option that keeps ADR-0004's web promise honest while not fighting the
ecosystem on native. Pure "stay put" (A) is fine today but only defers the forced SDK-55 cutover;
pure "flip everything" (B) sacrifices the web Planner interaction for a native-only win.

## Migration plan (phased, each phase gate-green before the next)

- **Phase 0 (this ADR):** decision recorded; register/roadmap updated.
- **Phase 1 — SDK 54 spike (branch `chore/rn-new-arch-migration`):** `expo install expo@^54` +
  `expo install --fix` (RN 0.81, React 19). Run typecheck / lint / tests / **web build + headless
  render**. Deliverable: an empirical report of exactly what breaks (React-19 fallout, deep-import
  breaks, web render). No merge — data only.
- **Phase 2 — React 19 test tooling:** react-test-renderer 19 + @testing-library/react-native 14;
  fix component render tests (ADR-0027). Gate green on the new React.
- **Phase 3 — Reanimated 4:** add `react-native-worklets`, swap Babel plugin, migrate any
  incompatible reanimated usage (Island, mascots, LiveMark, ReanimatedTimer, mount hook). Verify
  web still renders (JS path) and native animation on a real build.
- **Phase 4 — gesture-handler 3 + Planner:** migrate PlannerScreen to the v3 hook API; wrap the app
  root in `<GestureHandlerRootView>` (missing today — a latent bug regardless of version); **gate
  the drag/resize off web** to the typed dialog per the Phase 1 finding. Browser-acceptance must be
  green.
- **Phase 5 — verification:** full `./test.sh` + Integration + Browser acceptance green; native
  build sanity (EAS) out-of-band; update arc42 Runtime View + Stack table; close #357.

## Consequences

- The `pnpm.overrides` React-18 pin is removed; React 19 becomes the baseline (unblocks the held-back
  test libs and moves TS/tooling forward, though TS7 remains gated by typescript-eslint separately).
- The app carries a **two-tier interaction** for the Planner block editor: gesture on native, typed
  dialog on web. This must be reflected in `docs/design/ux-vision.md` (web is a deliberate,
  honest reduction on that one surface).
- react-native-web's maintenance-mode status becomes a tracked strategic risk (a future ADR may
  evaluate `react-strict-dom`).
- Until Phase 5 is green, gesture-handler stays at `~2.20.2` on `main` (PR #355 state).
