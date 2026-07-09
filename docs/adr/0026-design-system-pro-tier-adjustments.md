# 0026. Design System Pro Tier Adjustments

Date: 2026-07-09

## Context

The initial port of the `myDevTime Design System` established a strong foundation (dark-first palettes, deterministic categorical colors, 3 swappable accent themes). However, an expert UX review identified several shortcomings that prevented the UI from functioning at a true "Enterprise/Pro" level:

1. **Information Density**: The strict adherence to Apple's HIG (44px minimum touch targets) across all environments created a bloated, "Fisher-Price" aesthetic on large desktop screens where professionals expect high data density.
2. **Categorical Color Limits**: The project palette consisted of only 5 colors. For power users managing many active projects, these colors would repeat too frequently, destroying their semantic value on the Day Canvas.
3. **Contrast Variability**: Soft semantic backgrounds (`--accent-soft`, `--warn-soft`) were implemented using `rgba(...)` alpha values. When layered over differing background elevations (surface vs. sunk vs. raised), the final blended color resulted in unpredictable contrast ratios, often failing WCAG AA compliance.
4. **Logo Scalability**: The new "Now-Split" logo contains intricate details (a dashed ghost block) that dissolve into "pixel-mush" when scaled down to a 16x16 favicon or a mobile tab icon.

(Note: A fifth issue regarding multi-font layout shifts was explicitly deferred).

## Decision

We are implementing four targeted architectural adjustments to the design system:

1. **Density Tokens**: We are introducing a `Density` token (`regular` | `compact`) to the `Theme`. Spacing variables that control component heights (like `touchTarget`, `padCard`, `gapList`) will now resolve based on the active density. Mobile clients default to `regular` (44px targets), while desktop environments can opt into `compact` (32px targets).
2. **12-Color Project Palette**: We are expanding the `projectColors` array from 5 to 12 distinct, CVD-safe colors per mode (Light/Dark). The existing FNV-1a hashing function will seamlessly distribute projects across this larger palette.
3. **Absolute Soft Colors**: We are replacing all `rgba(...)` soft colors in the palette with their absolute, solid hex equivalents. These hex values are pre-calculated as if they were alpha-blended over the default background (`#ffffff` for light, `#10131a` for dark), guaranteeing mathematically exact WCAG contrast ratios.
4. **Micro Logo**: We are introducing a dedicated `icon-micro.svg` optimized for small sizes (<=32px), replacing thin dashes with thick, solid geometry to preserve legibility.

## Consequences

- The `Theme` object now requires a `density` property, though it can default to `regular`.
- UI components relying on hardcoded padding or the old global `touchTarget` export must be updated to read from `theme.densityScale.touchTarget`.
- Contrast testing (`contrast.test.ts`) must be updated to verify the new absolute hex colors against the background surfaces.
- We resolve the contrast failures immediately without needing complex runtime alpha-compositing logic.
