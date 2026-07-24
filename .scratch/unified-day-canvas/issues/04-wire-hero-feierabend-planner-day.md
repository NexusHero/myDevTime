## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 4.

## What to build

In the PlannerScreen Day view branch (the `view === 'Day'` section), replace the `PlannerDayTracker` (apps/mobile/src/components/planner/PlannerDayTracker.tsx) with the new `HeroTrackerBar` (from #361), and add the `ShutdownCard` (from #362) below the day canvas. Make `Day` the default landing view (currently opens on `Week`). Remove `PlannerDayTracker` entirely — the `HeroTrackerBar` fully replaces it (no dead code).

The Day view now carries: the hero tracker (big orange LiveButton + pause + billable + worked time) on top, the day canvas + Co-Planner plan blocks in the middle, and the Feierabend shutdown card + companions below. This is the merged "Today + Planner Day" surface.

## Acceptance criteria

- [ ] The Planner Day view renders `HeroTrackerBar` at the top (replacing `PlannerDayTracker`)
- [ ] The Planner Day view renders `ShutdownCard` below the day canvas (reads `useTodayEntries` + auto-tracker spans)
- [ ] `PlannerDayTracker.tsx` and its test are deleted — no dead code
- [ ] The Planner opens on `Day` by default (not `Week`)
- [ ] The clock-in/out (Ausstempeln) from the old `PlannerDayTracker` is preserved in the `HeroTrackerBar`
- [ ] The stop action fires the `StopSummaryToast` (from #363)
- [ ] The shared timer (`TimerContext`) and punch clock (`useWorktime`) are unchanged — no second clock
- [ ] `./test.sh` passes

## Blocked by

- #361 (HeroTrackerBar extraction)
- #362 (ShutdownCard extraction)
- #363 (StopSummaryToast helper)
