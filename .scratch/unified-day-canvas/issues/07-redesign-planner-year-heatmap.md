## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 7.

## What to build

Redesign `PlannerYear` (apps/mobile/src/components/planner/PlannerYear.tsx) to unify the heat scale with the redesigned month view (#366):

- Drop the `live` orange "NOW" border -> accent ring (consistent with the month view).
- Unify the `heat` function (apps/mobile/src/components/planner/PlannerYear.tsx:20) with the month's 5-step scale. Extract a shared `loadHeat(t, level)` helper to packages/design so both views consume one function.
- Keep the 12-month card layout (already heatmap-ish) — just align the colors and the today marker.

## Acceptance criteria

- [ ] The current month wears an accent ring (border), not a `live` orange border
- [ ] The "NOW" label is accent-colored (not `live` orange)
- [ ] The `heat` function is extracted to a shared `loadHeat(t, level)` in packages/design, consumed by both PlannerMonth and PlannerYear
- [ ] The 5-step scale matches the month view exactly (idle/sunk/soft/text/accent)
- [ ] `loadHeat` is unit-tested in packages/design (held to the coverage bar)
- [ ] `PlannerYear.test.tsx` updated and passing
- [ ] `./test.sh` passes

## Blocked by

- #366 (PlannerMonth heatmap redesign — establishes the shared scale)
