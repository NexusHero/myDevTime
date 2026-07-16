# ADR 0061: Design refresh v11 — Sovereign default, Clash Display display face, LiveMark + edge mascots

## Status

Accepted (owner decision) — **supersedes [ADR-0023]**'s default-accent choice
(Blueprint) and **extends** the themable design system ([ADR-0022], [ADR-0026],
[ADR-0030]) and the client motion pass ([ADR-0048]). Reconciles the app with the
v11 design-system handoff.

## Context

The owner delivered a refreshed myDevTime design-system export (v11: `readme.md`,
`SKILL.md`, `tokens/`, `fonts/`, `assets/logo/`, `components/`, `ui_kits/devtime/`).
A review against the current client found the system is already ~90 % implemented —
the three-accent × two-mode token architecture, the `--live` / `--ai-grad` concepts,
the JetBrains/Inter/Space-Grotesk wiring, and nearly the entire component set
(including CommandBar, AICallout/AIAskBar, BoxPlot, LoadMeter, all instruments) were
already shipped, and the app's copy is already English-only. The handoff mostly
**confirms** what exists.

Four genuine gaps remained, plus one contradiction in the handoff's own files about
the default accent (`colors.css`/`readme`/`SKILL` say **Blueprint**; `themes.css`
comment says **Sovereign**; `IMPLEMENTATION_PROMPT` says **Ember**). The owner chose
**Sovereign** — the flagship royal blue the handoff describes as the default identity.

The handoff is a **web CSS/JSX** system; the client is **React Native + Expo**, so
"1:1" means translating the spec into `packages/design` (TS tokens) and `apps/mobile`
(StyleSheet / react-native-svg), never copying `.css`/`.jsx`. No mock data is
imported — the frames are read as specification; every number stays wired to the real
API and empty states stay honest.

## Decision

1. **Sovereign is the default accent.** `DEFAULT_ACCENT = 'sovereign'` (royal blue
   `#3654E0`). Ember and Blueprint remain selectable; the neutral/mode split and all
   six accent × mode palettes are unchanged.

2. **Clash Display is the app display face for Sovereign & Ember.** The handoff pins
   Clash Display (titles, hero numbers) for all themes, with Blueprint swapping to
   Space Grotesk; **JetBrains Mono is the numeral face in every theme** ("numbers are
   the product"). Previously Sovereign/Ember fell back to system for both display and
   numerals. Now `sovereignFontFamily` = system UI · JetBrains numerals · Clash
   Display; `resolveFontFamily` maps `ClashDisplay*` to the loaded faces. Clash ships
   as native-loadable `.ttf` (Semibold + Bold, ITF Free Font License) in
   `apps/mobile/assets/fonts/`, required in the Expo font loader; lighter weights snap
   up to Semibold.

3. **LiveMark — the living logo mark.** A new `components/canvas/LiveMark` renders the
   "Now-Split" mark (solid actual block · orange S-signature · dashed ghost block)
   with the orange Now-dot as its living face: it blinks idle, pulses (with an
   expanding ring) while a timer runs, and jumps on `celebrate`. Only the dot animates
   (an overlaid `Animated.View`, the proven `LiveButton` pattern); all motion gates
   behind the OS reduced-motion setting. It is wired into the sidebar brand header
   bound to the shared timer state. Token-coloured (accent blocks, `live` S + dot) —
   no raw hex.

4. **Edge mascots Sevi & Blocky.** New `components/canvas/Sevi` (the Sevinç-dot with a
   face: focus/pause/celebrate) and `Blocky` (the Day-Canvas block as a figure:
   solid = tracked, dashed ghost = planned). Static token-coloured SVG, reduced-motion
   safe by construction. Used **only in the margins** — Sevi celebrates on the
   onboarding "Done" step, a Blocky duo introduces plan-vs-reality on the work-time
   step, and `EmptyState` gains an optional `mascot` slot — never in working UI; the
   logo mark itself stays faceless. Each carries one fixed brand-illustration hex (the
   face ink), recorded in the design-adherence baseline.

A token-value audit found no drift to correct: the project palette, `live`, and the
AI gradient already match the handoff (the dark-mode `live` tint is an intentional
mode adjustment, not drift).

## Consequences

- **Pros**: the app matches the v11 design identity — Sovereign flagship default,
  the brand Clash Display display voice in the default themes, and the playful-but-
  bounded living mark + edge mascots the handoff calls for. All additions are
  token-driven and reduced-motion-safe; no mock data enters the app.
- **Cons / limits**: Clash Display ships only Semibold + Bold as `.ttf`, so display
  weights below 600 snap up (no Medium face on native). The mascots and LiveMark are
  rendered static/dot-only rather than with the handoff's full CSS keyframe
  choreography — a deliberate scope bound that keeps them reduced-motion-safe and
  test-stable; richer motion (Sevi bob/hop, phone tab-bar LiveMark, the splash
  self-signing sting) is a follow-up behind the same components.
- **Testing**: `packages/design` keeps ≥ 90 % coverage (default-accent + font-face
  resolution assertions updated); `apps/mobile` adds render tests for LiveMark and the
  mascots (ADR-0027 tier, reduced-motion rest state).
