# ADR 0030. Comprehensive Design System — Token-Based Architecture with Themable Accents

## Status

Accepted — realizes and extends ADR-0011/0022/0023/0026 by completing the visual language foundation and establishing a production-ready component token layer. Closes the design-system spike and unblocks full-fidelity UI implementation across all platforms (iOS/Android/Web).

## Context

The myDevTime visual identity must operate across three distinct platforms (iOS, Android, Web) from a single React Native + Expo codebase, with support for multiple user-selected themes. Prior ADRs (0011, 0022, 0023, 0026) established the architecture — token-based theming, three swappable accent themes (Sovereign/Ember/Blueprint), density scaling — but the implementation was incomplete:

1. **Token Scale Gaps**: The initial `packages/design` had a foundational spacing grid (s1–s7) and a limited font scale (xs–xl). Full-fidelity screen layouts require an expanded token range: spacing down to 0pt and up to 64pt (s0–s8), extended typography (2xs–3xl, line heights, letter spacing, border widths), and motion timing that differentiates user interactions (fast 140ms, spring 220ms, slow 320ms).

2. **Brand Asset Integration**: The product's visual identity — logos, splash screens, wordmarks, mark glyphs — existed but was not integrated into the app build or the design token layer. Branding must be deterministic and canonical so all platforms render the same identity without reimplementation.

3. **Font Loading**: Three accent themes each require distinct font families — Blueprint uses Inter/JetBrains Mono/Space Grotesk (via expo-google-fonts), while Sovereign and Ember fall back to system fonts. Fonts must load reliably without layout shift and guarantee that numerals always render in monospace (critical for financial data alignment).

4. **Component Styling**: Components existed but their styling was inconsistent — some using ad-hoc spacing, others hardcoding font sizes, none consuming the full expanded token palette. This fragmentation risked visual inconsistency when density or theme changed.

5. **Reproducibility**: Without a single source of truth, each platform (iOS/Android/Web) would require separate design adjustments, multiplying maintenance burden and risking drift. A token-based, code-first approach ensures all platforms render identically.

## Decision

We are adopting a **comprehensive, production-grade design system** based on the established token-and-theme architecture (ADR-0022/0023):

1. **Expanded Token Scale** (`packages/design/src/tokens.ts`):
   - **Spacing**: Complete 8pt grid s0–s8 (0, 4, 8, 12, 16, 24, 32, 48, 64pt). Semantic spacing (`gapChip`, `gapList`, `gapSection`, `padCard`, `padApp`) maps to specific use cases.
   - **Typography**: Font sizes (2xs: 11px through 3xl: 42px), line heights (tight: 1.1 through relaxed: 1.7), letter spacing (tight: –0.02em through wider: 0.12em), with explicit monospace numerals for data.
   - **Radius**: Extended from the basic set (chip, block, card, pill) to include xl (20px) for larger surfaces.
   - **Motion**: Explicit timing curves (fast: 140ms for UI feedback, spring: 220ms for transitions, slow: 320ms for entrances) and easing functions (out: cubic-bezier for exits, spring: cubic-bezier for bouncy returns), gated behind OS `prefers-reduced-motion`.
   - **Borders**: Hairline (1pt), medium (1.5pt), thick (2pt) for precise hierarchy.
   - **App Shell Geometry**: Fixed dimensions (rail 76pt, sidebar 248pt, topbar/tabbar 64pt) for consistent navigation layout across phone/tablet/desktop.

2. **Integrated Branding Assets**:
   - Logo variants (icon, icon-light, icon-micro, mark-glyph, wordmark, lockup-horizontal, favicon, splash) are canonical SVGs, integrated into `packages/design/assets/logo/` and exported from `packages/design/src/branding.ts`.
   - Each variant is optimized for its context (splash for launch, favicon for browser, icon-micro for small tabs), ensuring consistent identity across all platforms.
   - App shell (expo `app.json`) references canonical branding assets, so all platforms derive the splash and icon from the same source.

3. **Font Integration**:
   - **Blueprint accent** (default) loads Inter, JetBrains Mono, Space Grotesk via `@expo/google-fonts` — guaranteeing consistent rendering across iOS/Android/Web.
   - **Sovereign and Ember accents** fall back to system fonts (SF Pro Display on iOS, Roboto on Android) for zero-dependency theming.
   - Numerals always render in `fontFamily.numeric` (JetBrains Mono for Blueprint, system monospace for others), ensuring tabular alignment critical for financial data.
   - Font weights resolve to concrete loaded faces (avoiding faux-bold), preventing rendering inconsistencies.

4. **Component Token Consumption**:
   - All components (Button, Badge, Card, Input, Switch, Tabs, Island, DayBlock, Row, ProgressBar, BudgetRing, Gauge, Sparkline) consume the expanded token palette through the `useTheme()` hook.
   - Components no longer hardcode spacing or sizing; they read from theme (e.g., `theme.spacing.s4`, `theme.fontSize.sm`, `theme.radius.card`, `theme.motion.fast`).
   - Touch targets meet accessibility minimums (≥44pt regular, ≥32pt compact), gap and padding follow the 8pt grid, and all colors are WCAG AA–verified by the deterministic contrast layer.

5. **Theme Resolver Completeness**:
   - The `theme()` factory (in `packages/design/src/theme.ts`) bundles all tokens, colors, and density into a single `Theme` object.
   - All six combinations (3 accents × 2 modes) are tested for visual fidelity and contrast compliance.
   - Clients access the theme via `useTheme()` context hook; a single re-export from `@mydevtime/design` exports all token types and type guards.

6. **Project Color Determinism**:
   - Projects are assigned categorical colors via **FNV-1a hash** of their ID, ensuring:
     - Same project keeps the same color across devices/sessions.
     - Color persists when accent theme flips.
     - 12-color palette (per mode) rotates without repetition for reasonable project counts.
   - No need to store color per project; it is computed on demand.

## Consequences

- **All UI is now token-driven.** Hardcoded pixels have been replaced by semantic spacing (`s0`–`s8`), typography (`2xs`–`3xl`), and motion tokens. Changing a token value ripples across the entire app.
- **Theming is first-class.** Users can swap between three accent themes and two modes (light/dark) at runtime; the deterministic contrast layer guarantees WCAG compliance across all six combinations.
- **Platforms are identical by construction.** iOS, Android, and Web render the same spacing, font weights, and colors because they all consume the same token definitions. Drift is impossible.
- **Maintenance burden drops.** Design tweaks (e.g., "increase s4 from 16pt to 18pt") are one-line token edits, not six separate component updates.
- **Future design changes are low-risk.** Adding a new accent, adjusting density, or expanding the font scale is a token addition/edit, never a pervasive component rewrite.
- **Density scaling is complete.** Regular (44pt touch targets) and Compact (32pt) modes are fully supported; mobile defaults to Regular, desktop can opt into Compact. The theme resolver handles density-dependent spacing automatically.
- **Branding is deterministic.** All platforms fetch logos and splash screens from the same SVG sources, eliminating pixel-level drift and ensuring brand consistency.
- **Cost:** `packages/design` tokens are now comprehensive, increasing the package's import payload slightly (though it remains a pure TS layer, tree-shakeable). Components must be audited to ensure they read from theme (not hardcoded values), which is mechanical but non-negotiable.
- **Coupling note:** The font loading for Blueprint accent introduces `@expo/google-fonts` as a soft dependency. Sovereign/Ember accents remain zero-dependency, and the theme resolver gracefully falls back if fonts don't load (system fonts step in).

## How This Realizes the Original Vision (ADR-0011 & Ancestors)

ADR-0011 committed to a "binding UX vision with a prototype gate before component code." That prototype demonstrated the visual language (Day Canvas, ghost blocks, Island, deterministic colors) but left the token-and-component infrastructure incomplete. This ADR completes that infrastructure so that:

- Every on-screen pixel now flows from a token, guaranteeing that design changes propagate without manual per-component edits.
- The "binding" nature of the UX vision is enforced at the token layer: ghost blocks *cannot* be solid (their radius and border are hardcoded to dashed in `DayBlock`), numerals *cannot* render in a serif font (because `fontFamily.numeric` is locked to monospace), and colors *cannot* violate WCAG (because the palette builder tests every combination).
- The multi-platform constraint (one codebase for iOS/Android/Web) is satisfied by having all three platforms consume the same token definitions; visual consistency is mathematical, not aspirational.
