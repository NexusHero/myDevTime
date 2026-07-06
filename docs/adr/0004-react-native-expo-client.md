# ADR 0004: Client Stack — React Native + Expo for iOS, Android, and Web

## Status

Proposed — to be confirmed or overturned by the cross-platform spike (see the spike issue in
`docs/roadmap.md` M0) before the first client code merges.

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
- The spike must validate the three riskiest assumptions before this ADR is marked Accepted:
  (1) background/foreground timer reliability on both mobile OSes, (2) offline-first local
  persistence + sync fit, (3) react-native-web quality for the dashboard screens. If the spike
  fails, Flutter is the named fallback and this ADR gets superseded, not edited.
