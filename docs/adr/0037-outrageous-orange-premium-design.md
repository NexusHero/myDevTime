# ADR 0037: Outrageous Orange Accent & Premium Design Upgrade

## Status

Accepted — **extends ADR-0022** (three-accent design system) and **ADR-0026** (pro-tier adjustments).

## Context

A competitive analysis of industry-leading time trackers (Toggl Track, Clockify, Awork) and the travel platform GetYourGuide revealed that myDevTime's visual aesthetic was functional but not yet premium-grade. The most impactful missing elements were:

1. **A signature brand color**: GetYourGuide's "Outrageous Orange" `#FF5533` is a proven, high-energy accent that communicates urgency and action — exactly the feeling a time-tracking timer should evoke.
2. **Micro-animations**: Awork and Toggl use subtle scale transforms and shadow blooms on interactive elements (buttons, cards) to create a "tactile" feel.
3. **Oversized typography**: Toggl Track's timer display uses very large numerals (`48–64pt`) to command the screen and make the timer the hero element.
4. **Premium iconography**: Awork uses rounded, consistent-weight SVG icons throughout, not system defaults.

## Decision

1. **Fourth accent theme — "Outrageous"**: We add `#FF5533` (GetYourGuide Orange) as a fourth swappable accent in the existing three-accent architecture. Blueprint remains the default; the user can opt into Outrageous from Settings.
2. **Extended type scale**: `fontSize.xxl` (48pt) and `fontSize.xxxl` (64pt) are added for hero displays (timer, kiosk view).
3. **Extended motion scale**: `motion.bouncy` (400ms) and `motion.fluid` (500ms) are added for richer UI transitions beyond the existing `fast`/`spring` pair.
4. **Button micro-animations**: Primary buttons receive `transform: scale(0.97)` on press and a soft `shadowColor`-based glow.
5. **Lucide icon library**: `lucide-react-native` replaces ad-hoc icons, wrapped in a custom `Icon.tsx` component for consistent stroke width and color binding to the theme.

## Consequences

- The `AccentTheme` type gains a fourth member: `'outrageous'`.
- `ACCENT_THEMES` grows from 3 to 4 entries.
- `fontSize` gains `xxl` and `xxxl`; `motion` gains `bouncy` and `fluid`.
- All existing palette/contrast tests must be updated to iterate over 4 accents.
- `lucide-react-native` is a new dependency in `apps/mobile`.
- The Outrageous accent's `accentText` values are tuned per mode to meet WCAG AA-Large on the neutral surfaces.
