# ADR 0004: Client Stack — React Native + Expo for iOS, Android, and Web

## Status

**Accepted (provisional)** — confirmed by the cross-platform spike
([#1](https://github.com/NexusHero/myDevTime/issues/1), findings in
[`docs/spikes/0001-client-rn-expo.md`](../spikes/0001-client-rn-expo.md)). The spike resolved the
architecture, offline-first/sync-fit, and react-native-web risks with machine-checked evidence and
found no Flutter-fallback trigger. Two intrinsically device-bound checks — a running timer
surviving a hard **reboot**, and the Day Canvas holding **60fps** on a mid-range device — remain as
a documented on-device checklist (C1–C7 in the findings). Client code may proceed on this basis;
the **"provisional"** qualifier is dropped once that checklist is signed off. If any core check
fails and cannot be resolved at the native edge, this ADR is **superseded** by a Flutter decision,
not edited.

## Context

ADR-0002 requires iOS, Android, **and** Web from 1.0, with Tyme-class native feel on phone and
tablet. The candidates were React (web) plus something native, **Flutter**, or **React Native**.
A solo developer cannot sustain three separate codebases, so the real choice is Flutter vs. React
Native — both deliver iOS + Android + Web from one codebase. The backend is TypeScript
(ADR-0003), and shared domain types across client and server (time math, budgets, validation) are
a major leverage point for a one-person team. The product's UX bar is set by Tyme: timers,
widgets, background tracking, offline-first local data — all of which need reliable access to
platform capabilities.

## Decision

**React Native + Expo**, with **react-native-web** for the web target and Expo Application
Services (EAS) for store builds. One TypeScript codebase for all three platforms, sharing domain
packages with the backend. Platform-specific surface (widgets, live activities, background
timers) is isolated behind interfaces so native modules stay at the edge, per the process skill
§2.2.

## Alternatives considered

- **Flutter:** first-class cross-platform quality and arguably better out-of-the-box rendering
  consistency, but Dart forfeits the shared-TypeScript-domain advantage and adds a second language
  to the project; Flutter Web's DOM-less rendering also makes a keyboard-first, accessible web app
  harder than react-native-web's real DOM.
- **React web + two native apps (Swift/Kotlin):** best possible native feel, triple maintenance —
  not sustainable solo.
- **PWA/Capacitor only:** cheapest, but background timers, widgets, and store-quality UX are
  exactly where wrapped web apps fall short of the Tyme benchmark.

## Consequences

- One codebase, one language across the entire product; domain logic imports the same shared
  packages the backend uses.
- The web target inherits react-native-web's constraints; genuinely web-only surfaces (marketing
  pages, invoice PDFs) can be plain React without violating this ADR.
- Widgets/watch complications/live activities require native modules — budgeted as
  platform-specific work at the edges, not a reason to fork the codebase.
- The spike validated the riskiest assumptions (see the findings): (1) background/kill/reboot
  timer reliability — solved by deriving elapsed from persisted epoch timestamps, not ticks;
  (2) offline-first local persistence mapping cleanly onto the deterministic sync engine
  (ADR-0019); (3) react-native-web quality for a keyboard-first dashboard; and (4, added by
  ADR-0011) Day Canvas direct manipulation at 60fps via Reanimated worklets. The correctness-
  critical logic for each is a pure, unit-tested module reusable by the real client. The residual
  device checklist (C1–C7) is the only gate left before the "provisional" status is removed; a
  core failure there is the Flutter-fallback trigger, and this ADR would be superseded, not edited.
