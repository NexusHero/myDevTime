# ADR 0035: Bounded Screens — a page's scroll depth must not grow with workload

## Status

Accepted (owner decision, design v1) — extends the UX vision (ux-vision §2/§3) and the design-system
handoff. First slice landed: the pure `boundedList` primitive in `packages/design` and its first
consumer (`ProjectsScreen`). The remaining consumers (Today entries, Reports breakdowns) and the
viewport-locked app-shell adopt the same rule in follow-up PRs.

## Context

The 3-persona user tests surfaced a concrete failure mode: screens that are calm for a light user
(Lena) turn into long, disorienting scrolls for a heavy one (Hannes). The design owner's v1 revision
makes this a hard rule:

> **A screen whose scroll depth depends on the user's workload is a bug.**

Density must show as *fill level inside a bounded frame*, not as *scroll depth*. Concretely (design
v1): the app shell is viewport-locked and never scrolls — each screen owns exactly one internal
scroll pane, with its title/hero fixed. Time-bound data lives on the fixed-height Day Canvas.
Overbooked/"no room" work becomes a horizontal chip shelf, not a longer list. And long record lists
render as **distribution instruments**: sorted by what matters, the top *N* shown, and the rest
behind a "+N weitere" drill-in.

## Decision

- **`boundedList(items, limit, expanded)` is the pure primitive** for the list case: it returns the
  visible head (`shown`, ≤ `limit`) and a `hidden` count for the "+N weitere" affordance; `limit` is
  floored and clamped to ≥ 0; `expanded` shows everything. Pure and exhaustively tested in
  `packages/design` (the client renders `shown` + the affordance, never re-implements the split).
- **`ProjectsScreen` is the first consumer:** one flat list **sorted by budget risk** (consumption
  ratio; uncapped projects sink to 0), the top `limit` visible (6 on the two-column desktop grid, 3
  on phone) and a "+N weitere anzeigen" / "Weniger anzeigen" toggle. The per-client section grouping
  is retired in favour of the single risk-sorted instrument (design v1's Projects layout).
- **No deterministic-core impact:** this is presentation only — sorting and slicing a view, no
  domain/number/persistence change.

## Consequences

- Every list-bearing screen has one place to enforce the rule; adding a consumer is `boundedList` +
  a show-more button, not a bespoke slice each time.
- The Projects screen's height is now independent of the project count — the exact regression the
  user test flagged.
- Follow-ups tracked separately: viewport-locked `AppShell` (fixed header + single scroll pane per
  screen), the Today entries distribution instrument, and the horizontal "ohne Platz" chip shelf.

## Alternatives considered

- **Paginate / infinite-scroll long lists:** rejected — still couples scroll depth to workload and
  hides the "what matters most" signal; the bounded top-N + drill-in keeps the screen glanceable.
- **Keep per-client grouping on Projects:** rejected for the phone/default view — grouping re-grows
  with client count and buries the at-risk project; risk-sorted flat list is design v1's call.
- **Put `boundedList` in `packages/domain`:** rejected — it is presentation/layout logic, not
  business rules; it belongs with the other pure UI primitives in `packages/design`.
