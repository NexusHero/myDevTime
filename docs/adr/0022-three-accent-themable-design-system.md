# ADR 0022: A Themable Design System — Three Swappable Accents (Sovereign / Ember / Blueprint)

## Status

Accepted — **extends ADR-0011** (the binding UX vision + design language) and realizes the
component-and-token half of issue [#11](https://github.com/NexusHero/myDevTime/issues/11). Amends
the palette assumption of the settled visuals: where the prototype validated a *single* accent
("Ember"), the design system now ships **three swappable accents on one token architecture**, with
**Sovereign** — not Ember — as the flagship default. The ghost/actual provenance rule, the
instrument viz language, and every principle of ADR-0011/ux-vision are unchanged.

## Context

Issue #11 builds the shared UI foundation; ADR-0011 made the UX vision binding and gated component
code behind the prototype (#39). The prototype validated the *structure* (Day Canvas, the Island,
instrument stats, ghost-vs-actual) with one amber accent. Turning that into the actual product
design system surfaced a decision the prototype didn't settle: **how many accent identities the
product carries, and which is the default.**

The owner's brand brief (German, paraphrased in the design system's own readme) is explicit: make
the design as differentiating as the feature set, and ship a **swappable-theme system like the
sister product myJob's** (Blueprint / Signal / Graphite), *not* a single fixed palette — so
candidate identities can be compared side by side in both light and dark. Three earn their place:

- **Sovereign** (royal blue `#3654E0` + white) — a new flagship: trust, clarity, premium, and
  distinct from every competitor's amber/green.
- **Ember** (`#E8A33D`) — myDevTime's already-validated "now/live" accent from the binding UX
  vision (it is the "now" playhead color, not a random skin), kept as a first-class option.
- **Blueprint** (`#2563EB`) — myJob's steel blue ported 1:1 (including its font trio) for buyers
  who want the two products to read as one family.

The existing `packages/design` encoded only Ember, as a single resolved `dark`/`light` palette.
Adopting a multi-accent system is a cross-cutting change to the settled visual language, so it
takes an ADR (process skill §1.2).

## Decision

Adopt a **two-axis token architecture** in `packages/design`, mirroring the source design project's
`data-theme` (accent) × `data-mode` (light/dark) split:

- **`accent` axis** — `sovereign` (default) · `ember` · `blueprint`. **Sovereign is the flagship
  default** (`DEFAULT_ACCENT`); `theme(mode)` with no accent resolves to it.
- **`mode` axis** — `light` · `dark`, unchanged; dark-first default behavior stays (ux-vision §4,
  `resolveMode`).
- **Neutrals and status colors depend only on `mode`** and are shared across all three accents;
  **only the four accent tokens** (`accent`, `accentInk`, `accentText`, `accentSoft`) depend on the
  accent. A resolved `Palette` is `neutrals(mode)` composited with `accent(theme, mode)`, so every
  component works unmodified under all six combinations.
- **The project palette stays accent-independent** — a project keeps its identity when the accent
  flips (ux-vision §4: "the data is the color, chrome stays quiet").
- **The a11y contract scales to all six combinations**: `accentText` is tuned per accent × mode
  (light darkens Ember to its 700 shade; dark uses the brighter on-dark tint) and the contrast
  test now asserts WCAG AA across every accent × mode, not just the two Ember palettes.
- **API:** `theme(mode, accent = 'sovereign')`; `dark`/`light` remain exported as the Sovereign
  defaults; new exports `palettes`, `ACCENT_THEMES`, `DEFAULT_ACCENT`, `AccentTheme`. The RN client
  threads a user-selectable accent through `ThemeProvider` (`useAccent`).

Typography stays on the system sans + system mono for Sovereign/Ember (lighter, native feel);
**Blueprint's font trio (Space Grotesk / Inter / JetBrains Mono) is deferred to the font-loading
slice** — the accent tokens land here, the self-hosted webfonts wire in when the client loads them.

## Alternatives considered

- **Keep a single fixed accent (Ember only):** simplest, matches the prototype 1:1, but directly
  refuses the owner's brief ("swappable-theme system … not a single fixed palette") and forecloses
  the family-resemblance play with myJob. Rejected.
- **A free/open-ended theming API (arbitrary accent hex):** maximal flexibility, but every accent
  must pass the per-mode AA contract and be CVD-sane; an open input can't be tested to the ≥90%
  bar. Rejected in favor of three curated, tested accents.
- **Per-accent neutral scales:** rejected — it multiplies the surface/ink matrix by three for no
  brand gain; the brief wants *accent* differentiation, and shared neutrals are what keep the three
  themes a family rather than three unrelated skins.

## Consequences

- `packages/design` stays pure and on the coverage bar: the palette is now data + one `compose`
  function, exercised by `palette.test.ts`, and the a11y contract runs across six combinations.
- Any component built for #11 (core primitives, the Island, DayBlock, the instruments) is authored
  once and is correct under all three accents automatically — it reads semantic tokens, never raw
  accent values.
- A user-facing accent switcher becomes possible; it lands with the Profile/settings screen slice.
  Default is Sovereign, so the app's out-of-the-box look changes from amber to royal blue.
- Blueprint is visually complete but **renders in the system font trio until the webfont-loading
  slice**; this is a known, bounded follow-up, not a silent gap.
- Ghost-vs-actual and the instrument shapes are untouched — provenance and the anti-false-precision
  viz rules from ADR-0011 remain the non-negotiables, independent of accent.
