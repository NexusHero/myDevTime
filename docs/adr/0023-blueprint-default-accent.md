# ADR 0023: Königsblau (Blueprint) as the Default Accent

## Status

**Superseded by [ADR-0061](0061-design-refresh-v11-sovereign-default-clash-display-live-mark-mascots.md)**
(Blueprint → Sovereign, v11 design refresh). Retained for history.

Accepted — **supersedes the default-accent selection of [ADR-0022](0022-three-accent-themable-design-system.md)**
(Sovereign → Blueprint). Everything else in ADR-0022 stands unchanged: the two-axis token
architecture (accent × mode), the three swappable accents on shared neutrals, and the WCAG-AA
contract across all six accent × mode combinations. This ADR changes **which** accent is the
out-of-the-box default, nothing about how the system is built.

## Context

ADR-0022 shipped three curated accents and named **Sovereign** (`#3654E0`) the flagship default.
With the client now running (live Today / Projects / Profile screens on the shared Expo /
React-Native-Web codebase), the owner reviewed the accents side by side on real screens and chose
**Blueprint** (`#2563EB`) — "Königsblau" — as the product's default face: a cleaner, brighter royal
blue than Sovereign's slightly indigo cast. Sovereign and Ember remain first-class,
user-selectable accents; only the default changes.

The default accent is a one-line data decision (`DEFAULT_ACCENT`), but ADR-0022 made it an explicit
architectural choice, so reversing it is done by superseding ADR (process skill §1.2), not by
silently editing the constant.

## Decision

- **`DEFAULT_ACCENT = 'blueprint'`.** `theme(mode)` with no accent argument resolves to Blueprint,
  and the convenience `dark` / `light` palette exports track `DEFAULT_ACCENT` (so they follow the
  default rather than pinning to a named accent).
- **The accent set and switcher are unchanged** — `ACCENT_THEMES` keeps its historical order
  (`sovereign · ember · blueprint`); Sovereign and Ember stay fully available via `useAccent`.
  Reordering the list is deliberately *not* done here (cosmetic, and it would reshuffle the
  settings switcher for no functional gain).
- **The a11y contract already covers Blueprint** across both modes (ADR-0022's contrast test spans
  every accent × mode), so no new contrast work is needed.

Blueprint's bespoke font trio stays deferred exactly as ADR-0022 set out: the default look uses
Blueprint's **accent colors on the system font trio** until the webfont-loading slice wires in the
self-hosted fonts. Making Blueprint the default does not pull that work forward.

## Consequences

- The app's out-of-the-box look is Königsblau; the README screenshots and badges reflect the real
  default, not a forced override.
- Fully reversible — it is one constant plus the `dark`/`light` alias source; no component changes,
  because every component reads semantic tokens, never raw accent values (ADR-0022).
- Sovereign is **not** removed or downgraded in capability; it loses only its default status and
  can be reinstated by a future superseding ADR if the brand direction changes.

## Alternatives considered

- **Keep Sovereign as default:** rejected — the owner's explicit visual preference after seeing the
  running app is Blueprint.
- **Also make Blueprint first in `ACCENT_THEMES` / the switcher:** deferred — the ordering is purely
  presentational and changing it now would churn the settings UI without functional benefit.
- **Pull Blueprint's webfont trio in with the default switch:** rejected — font loading is its own
  bounded slice (ADR-0022); coupling it here would widen scope for no immediate gain.
