# ADR-0076 — Entry detail: a docked master–detail column on wide viewports; overlay sheet on narrow

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** NexusHero
- **Relates:** ADR-0063 (typed Planner entry drawer — this refines its presentation),
  ADR-0075 (unified Day Canvas), ADR-0004 (RN + Expo, one codebase), REQ-037/REQ-040,
  issue #370

## Context

Tapping a calendar entry already opened the typed `PlannerEntryDrawer` (ADR-0063). It was always
presented the same way: an **absolutely positioned sheet with a dark scrim**, marked
`accessibilityViewIsModal`, floating over the whole screen.

On a phone that is right. On a tablet or a desktop browser it is not: the calendar the user is
reasoning about gets covered and made inert exactly when there is plenty of room to show both. The
responsive model already promised the other shape — `chromeForWidth(width).splitView` is `true`
from the tablet breakpoint up — but nothing consumed it for the entry detail; it only drove
navigation.

Two further gaps came out of reading the merged Day-canvas code:

1. **The Month grid could not open an entry at all.** A tap anywhere in a month cell drilled into
   the Day view. The month rendered task chips, but they were inert `View`s, and `buildMonthDays`
   dropped the occurrence's `kind`/`startMin`/`lenMin`, so there was nothing to *show* even if a
   chip had been tappable.
2. The drawer body was a fixed, non-scrolling block — long content (recurrence editor, travel
   route form) could not be reached in a short viewport.

## Decision

**One drawer component, two presentation modes, chosen by a pure width function.**

Add `detailPanelForWidth(width)` to `packages/design/src/responsive.ts` — the same module that
already owns `layoutForWidth`/`chromeForWidth`, so "phone / tablet / desktop" stays *one* tested
decision rather than a second threshold scattered across screens:

- **`docked`** (viewport ≥ `DETAIL_PANEL.dockMinWidth` = 840 pt): the detail is an ordinary flex
  child in a master–detail row. No scrim, **not** `accessibilityViewIsModal`, does not trap focus —
  the calendar beside it stays visible *and* clickable, and simply gets narrower.
- **`overlay`** (below it): today's full-height sheet with the backdrop, unchanged.

The dock threshold is derived, not picked: `dockMinWidth = minWidth (320) + minCanvas (520)`, so
docking is never offered at the cost of a usable canvas. The docked width is
`clamp(320, 380, 30 % of the viewport)`. The screen and the panel read the *same* function, so the
row reserves exactly what the panel renders.

**A month chip is its entry.** `DayTask` now carries the occurrence's `kind`, `startMin` and
`lenMin` verbatim (never re-derived — ADR-0005), the chips become pressables, and `PlannerMonth`
reports `(day-of-month, task index)` into the same deterministic `buildMonthDays` bucketing it was
given. The FullCalendar web month reports the identical pair, so both renderers feed one handler.
Nested pressables call `stopPropagation`, so one tap has one outcome: the chip opens the detail,
the surrounding cell still drills into the Day.

**A month entry opens read-only.** Its mutations (delete, nudge, duplicate, RSVP, protect, repeat)
are all indexed into the Day canvas's `blocks`, which the month has no handle on. Rather than wire
handlers that would act on the wrong block, the month detail shows the entry and offers no actions;
editing stays where the block lives. Honest over half-wired.

The drawer body is now a `ScrollView` in both modes.

## Consequences

- **Enabled:** the master–detail shape `splitView` promised is real for the entry detail — the
  desktop/tablet calendar behaves like a calendar inspector instead of a modal. The Month view stops
  being a pure drill-down surface: an entry can be inspected where it is seen.
- **One threshold, tested:** `detailPanelForWidth` is pure and covered in
  `responsive.test.ts` (docking point, clamping, degenerate viewports). No component re-invents it.
- **Accepted asymmetry:** a month-opened entry is read-only while a day-opened one is editable.
  This is a deliberate stop, not the end state — giving the month real actions needs an entry
  identity that survives from occurrence to canvas block, which is its own change.
- **Phones are untouched:** below 840 pt the behaviour, the scrim and the modal semantics are
  exactly as before, so nothing regresses on the smallest target.
- **Not a native OS window:** the "detail in its own window" idea is deliberately *not* taken. One
  in-app panel keeps iOS/Android/Web identical from one codebase (ADR-0004); a real second window
  would be a platform-specific surface with no home in the shared shell.
