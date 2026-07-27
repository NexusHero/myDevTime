## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 6.

## What to build

Redesign `PlannerMonth` (apps/mobile/src/components/planner/PlannerMonth.tsx) from a number-grid to a card-based heatmap:

- **Cells:** borderless, `radius.block`, `gap` between cells instead of hairline borders.
- **Heat fill:** 5-step accent-blue scale (idle `bg` -> `sunk` -> `accentSoft` -> `accentText` -> `accent`) driven by the existing pure `dayLoad` / `loadTone` (packages/design/src/projects.ts). Replace the 3px amber load bar with a full-cell tinted fill.
- **Day number:** quiet `ink3`, small; today gets an accent ring (border), not a loud orange pill.
- **Tasks:** keep the project-color left-border chips but lift them above the heat fill with a subtle surface background so they stay legible.
- **Booking-gap marker:** keep the hollow ring but switch from `warn` to `ink3` (information, not a warning).
- Drop the inline `fmtLoad` number (the heat IS the signal); show it only on tap/long-press.

This corrects the `live` orange back to its semantic scope (running timer / now-line only) per palette.ts. The pure logic (`dayLoad`, `loadTone`) is unchanged (ADR-0005).

## Acceptance criteria

- [ ] Month cells are borderless rounded rectangles with gap spacing (no hairline borders)
- [ ] Each day cell's background is a 5-step accent-blue heat fill (idle/sunk/soft/text/accent) driven by `loadTone`
- [ ] The 3px amber load bar is gone — the fill IS the load signal
- [ ] Today wears an accent ring (border), not an orange `live` pill
- [ ] Day numbers are quiet `ink3`, small
- [ ] The booking-gap marker is `ink3` (not `warn`)
- [ ] The inline `fmtLoad` number is hidden by default (available on tap/long-press)
- [ ] Task chips remain legible above the heat fill
- [ ] Every cell keeps an `accessibilityLabel` with day + load (REQ-043 — color is decorative)
- [ ] `PlannerMonth.test.tsx` updated and passing
- [ ] `./test.sh` passes

## Blocked by

None — can start immediately (independent of the Today-tab merge).
