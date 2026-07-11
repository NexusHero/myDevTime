# ADR 0034: Signal-Palette Refresh — Ember → Signal Orange, punched-up Live & Good

## Status

Accepted — **supersedes the Ember accent value and the light/dark `live`/`good` values of
[ADR-0022](0022-three-accent-themable-design-system.md)** (as carried by
[ADR-0026](0026-design-system-pro-tier-adjustments.md)/[ADR-0030](0030-comprehensive-design-system.md)).
Everything else stands: the two-axis token architecture (accent × mode), the three swappable accents
on shared neutrals, and the WCAG-AA contract across all six accent × mode combinations. This ADR
changes **values only**, no architecture. It is the first landed slice of the post-user-test design
refresh (the updated `design-system/` bundle, July 2026); the AI-signature gradient, the always-dark
app-shell, and the bounded-screens rework land in their own subsequent ADRs/PRs.

## Context

After the 3-persona user tests, the design owner revised the color system toward more decisive
"signal energy" (GetYourGuide-style hot accent paired with a royal-blue chrome). Three concrete
value decisions came out of that pass, all pinned as explicit choices by ADR-0022, so they are
changed by superseding ADR (process skill §1.2), not by silently editing constants:

1. **Ember** was a warm amber (`#E8A33D`) — validated once as the "now/live" accent, but it read as
   muted next to the product's live-orange signal and blurred the two roles.
2. **`live`** (the one theme-independent "happening right now" color — running timer, now-line, REC
   dot, logo playhead) was a comparatively soft red-orange (`#e5431c` light / `#ff5a2e` dark).
3. **`good`** read slightly dull on the light canvas.

## Decision

- **Ember becomes vivid signal orange** — `accent #ff5320` in both modes, with **white ink** on the
  fill (`accentInk #ffffff`, was near-black on amber). `accentText` darkens to the 700 shade
  (`#b33009`) in light so accent-as-text still clears WCAG AA-Large on a normal surface; dark uses
  the brighter on-dark tint (`#ff7a52`). Soft fills: light `#ffede6`, dark `#33201a`.
- **`live` is punched up to `#ff5320`** (light) / `#ff6b3d` (dark); `liveStrong` (the AA-tuned
  text/now-line shade) → `#e33e0f` (light) / `#ff5320` (dark); soft washes retuned
  (`#ffeae4` / `#362120`).
- **`good` is brightened** to `#16a34a` (light) / `#4ade80` (dark). Soft fills unchanged.
- **No component changes** — every component reads semantic tokens, never raw values (ADR-0022), so
  the new hues cascade app-wide from `packages/design/src/palette.ts` alone.

Ember's `accent` and `live` now share the same `#ff5320`. That is intentional: under the Ember
accent, "the interactive accent" and "the live signal" are the same hot orange, exactly as the
design intends. Under Blueprint/Sovereign the accent stays blue/indigo while `live` stays orange —
the theme-independence rule from ADR-0022 is unchanged.

## Consequences

- The a11y contract holds: the contrast test asserts `good`, `crit`, `warn`, `liveStrong`, and
  `accentText` clear AA-Large on every surface across all six accent × mode combinations; the new
  values were chosen to pass and the suite is green (`good #16a34a` → 3.30:1, `liveStrong #e33e0f` →
  4.23:1, Ember light `accentText #b33009` → 6.3:1 on white).
- Fully reversible — the change is a handful of hex values in one file; no migration, no component
  edits, no stored data references a color.
- Ember loses its "amber" identity; any doc prose that described it as amber is updated in this PR.

## Alternatives considered

- **Keep Ember amber, add a separate 4th "signal" accent:** rejected — widens the accent axis for no
  product need; the owner wanted Ember *itself* to be the signal accent.
- **Punch up `live` but leave Ember amber:** rejected — leaves the muted amber clashing against the
  new brighter live orange in the same view; the whole point was one coherent hot signal.
- **Edit ADR-0022 in place:** rejected — accepted ADRs are superseded, never edited (process skill).
