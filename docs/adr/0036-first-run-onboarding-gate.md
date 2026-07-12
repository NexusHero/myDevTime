# ADR 0036: First-run onboarding gate — a device-local seen/not-seen flag

## Status

Accepted (design v3) — implements the design owner's v3 onboarding flow (Welcome → Arbeitszeit →
Projekte → Auto-Tracker → Fertig) and the gate that shows it exactly once. Extends the UX vision
(ux-vision §5: trust is the aesthetic — privacy is stated where data is touched) and the bounded-
screens rule (ADR-0035: one card, one decision per step).

## Context

The v3 design adds a first-run flow: a short, skippable, bounded introduction that captures a daily
target, a first project (or an import), and an explicit opt-in for the local auto-tracker. It must
appear **once per device** and then never again — a returning user paints straight into the
workspace with no onboarding flash.

We have no app-wide durable storage primitive yet. Theme preference is in-memory; user preferences
persist server-side via the preferences API. Wiring AsyncStorage (native) or a server-side
`onboarded` flag now would be a larger slice than this presentation feature warrants, and would
couple the flow to infrastructure that is still to be decided.

## Decision

- **A tiny cross-platform seam, `onboardingStore`, owns one namespaced key** (`mydevtime.onboarded`).
  On the current render target (web / react-native-web) it reads and writes `localStorage`; on
  native it falls back to an in-memory flag until a durable store is chosen. All reads/writes go
  through `hasOnboarded()` / `markOnboarded()` — no other module touches the key.
- **`OnboardingGate` seeds its state synchronously** from `hasOnboarded()` and renders the flow when
  the flag is unset, otherwise its children. It sits **inside `AuthGate`** (after sign-in) and wraps
  the `TimerProvider`/`AppShell`, so the flow runs once between authentication and the workspace.
- **`OnboardingFlow` choices are local to the flow.** Nothing it collects is persisted yet: the
  daily target, projects, and tracker opt-in are captured in component state and handed to the
  workspace via `onDone`. Wiring those into the preferences/tracking APIs is a separate slice — this
  ADR covers only the gate and its one flag.
- **No deterministic-core impact:** presentation and a single boolean flag; no domain, number, or
  server-side persistence change.

## Consequences

- The flow shows exactly once per device with no flash for returning users, and there is a single
  place to move the flag when a durable store lands: swap the two functions in `onboardingStore`,
  gate and flow unchanged.
- On native today the flag is in-memory, so a cold app restart re-shows onboarding until the durable
  store is wired — acceptable for the current web-first render target, tracked as follow-up.
- The captured onboarding answers are not yet persisted; a follow-up slice threads them into the
  preferences and catalog APIs (daily target → work-time settings, first project → catalog, tracker
  opt-in → the same consent path as ADR-0033).

## Alternatives considered

- **Persist the flag server-side (per-user `onboarded`)** — rejected for now: re-shows onboarding
  correctly across a user's devices, but couples a presentation slice to an API round-trip and a
  schema change; the device-local flag is enough to ship the flow and is trivially replaceable.
- **AsyncStorage on native immediately** — rejected as premature: adds a native dependency before
  the durable-storage decision (theme/preferences persistence) is made; the in-memory fallback keeps
  the seam honest without prejudging that choice.
- **Show onboarding before `AuthGate`** — rejected: the flow references the signed-in workspace and
  the auto-tracker consent belongs to an authenticated user; running it after sign-in keeps the
  order coherent. The welcome step's "Ich habe schon ein Konto" affordance is decorative here (auth
  already happened upstream).
