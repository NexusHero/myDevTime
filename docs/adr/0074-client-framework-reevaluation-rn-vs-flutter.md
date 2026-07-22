# ADR-0074 — Client framework reevaluation: React Native + Expo confirmed; Desktop out of scope

- **Status:** Accepted (owner decision)
- **Date:** 2026-07-22
- **Deciders:** NexusHero
- **Relates:** ADR-0004 (React Native + Expo client — this ADR *confirms and refines* it),
  ADR-0005 (deterministic TS core), ADR-0073 (New-Architecture migration), issue #357

## Context

A Dependabot bump of `react-native-gesture-handler` to v3 blanked the web app (#357) and triggered
an honest reevaluation of the whole client-framework choice (ADR-0004): *did we bet on the wrong
stack to get iOS + Android + Web from one codebase, and should it have been Flutter?*

Two facts reframed the panic:

1. **The v3 breakage was a false alarm, not a symptom.** No released Expo SDK ships gesture-handler
   v3 — every current SDK, up to the newest (**SDK 57: RN 0.86 / React 19.2 / Reanimated 4.5**),
   pins gesture-handler on **2.x**. We are not behind by staying on v2; we are exactly where the
   entire Expo ecosystem is. gesture-handler v3 is Software Mansion's bleeding edge that Expo has
   not adopted anywhere.
2. **The one genuine trade of RN + react-native-web vs Flutter is Desktop nativity + pixel-identical
   animation everywhere** — and the owner has now decided **Desktop is out of scope**.

### The comparison (scored against this product's actual goals)

| Approach | Mobile feel | Web | Desktop | Identical animation *everywhere* | Shared **TS** core with our backend |
|---|---|---|---|---|---|
| **RN + Expo + react-native-web (ours)** | ★★★★★ | ★★★★ real DOM | ★★ (web-as-desktop) | ★★★ (web = JS thread) | ★★★★★ (all TS) |
| **Flutter** | ★★★★★ | ★★★ canvas | ★★★★★ native | ★★★★★ (one renderer) | ✗ (Dart — core not shareable) |
| KMP / Compose Multiplatform | ★★★★★ | ★★ (alpha) | ★★★★ | ★★★★ | ✗ (Kotlin) |
| Tauri + web UI | ★★ (mobile young) | ★★★★★ | ★★★★★ | ★★★ | ★★★★ (TS, no RN) |
| Capacitor / Ionic (WebView) | ★★★ | ★★★★★ | ★★★★ | ★★★ (DOM/CSS) | ★★★★ |
| Native per platform | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ✗ (no sharing, 3× work) |

Flutter wins exactly **one** axis — pixel-identical native feel + animation across *all* platforms,
including Web and Desktop. For this product that axis is **secondary**: animations here are light
(pulse, ring, living logo dot), and Desktop is now out of scope. Flutter *loses* the two axes that
**dominate** a time-tracking data app:

- **The shared TypeScript deterministic core** — `packages/domain` (every number deterministic and
  exhaustively tested, ADR-0005), the Zod schemas, and the NestJS backend are all TS, **shared
  server↔clients**. Flutter/Dart forecloses that sharing (rewrite the core in Dart = two truths, or
  thin clients that lose offline determinism). This is the product's spine, not a detail.
- **Real DOM web** — Flutter's web is canvas: weaker text selection, accessibility, SEO, print/
  export, and load weight. A time tracker with reports, tables and signable exports needs a real
  DOM web, which react-native-web gives.

## Decision

**Confirm ADR-0004: React Native + Expo + react-native-web, one TypeScript codebase.** Scope is
explicitly **iOS · Android · Web · Tablets**; **Desktop is out of scope** (owner decision). With
Desktop removed, RN + Expo has **no remaining real compromise** for this product's goals, while
Flutter would now be pure downside (lose the shared TS core + real DOM web, gain nothing that
matters here). Neither RN nor Flutter is "exotic" — they are the two mainstream cross-platform
giants; we picked the one that keeps our TS core shared and web as real DOM.

**gesture-handler v2 is "current," not backlog.** We track the Expo-blessed version set; we do not
adopt gesture-handler v3 (or any dependency) ahead of Expo. #357 stays as the tracking issue if that
ever changes.

## Consequences

- **Enabled:** the architecture question is settled; the only forward client-platform work is
  *currency*, not *rework*.
- **The one forward move (currency, not compromise):** ride the Expo SDK train **52 → 54/55** to pick
  up **React 19 + Reanimated 4** (native perf + the CSS-animation API) and unblock the held-back
  React-19 test libs — gesture-handler stays on v2, exactly as every Expo SDK does. Planned as its
  own effort (see ADR-0073 phases; needs an Expo-API-capable env — it can't run in the CCR sandbox).
- **Tracked risk, made conscious:** `react-native-web` is in maintenance mode (maintainer steering
  toward `react-strict-dom`). This is not a compromise we take blindly — it is an accepted,
  monitored risk with a trigger: if RNW stalls or a required web capability breaks, a future ADR
  evaluates `react-strict-dom` (or a Tauri/Electron shell **only if** Desktop is ever brought back
  into scope).
- **Foreclosed (by choice):** native Desktop feel; pixel-identical web animation. Both are
  acceptable because Desktop is out of scope and the app's animations are light.
- ADR-0004's provisional qualifier is effectively resolved by this reevaluation for the shipped
  scope (iOS/Android/Web/Tablets); the on-device checklist (C1–C7) remains its own follow-up.
