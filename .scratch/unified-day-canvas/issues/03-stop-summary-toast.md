## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 3.

## What to build

Formalize the stop-tracking toast ("Timer stopped — X tracked") into a small shared helper so both the hero bar and the Planner can fire it consistently. This is a thin wrapper over `useToast` (apps/mobile/src/components/core/Toast.tsx) — no new logic, just a named function that snapshots `timer.elapsed` before the optimistic clear and shows the toast.

## Acceptance criteria

- [ ] A `useStopSummaryToast` (or equivalent) helper exists and is consumed by `TodayScreen`'s `stopTracking`
- [ ] The toast text format is unchanged: "Timer stopped — {tracked} tracked."
- [ ] The elapsed snapshot is taken **before** `timer.punchOut()` (the optimistic clear)
- [ ] `TodayScreen` behavior is unchanged — all existing tests pass
- [ ] `./test.sh` passes

## Blocked by

None — can start immediately.
