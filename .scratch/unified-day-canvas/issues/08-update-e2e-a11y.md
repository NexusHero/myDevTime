## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 8.

## What to build

Update the E2E and a11y tests for the merged surface and the redesigned calendar:

- Update `e2e/tests/feierabend.spec.ts` — the Feierabend ritual now lives on `/planner` Day view (not `/today`).
- Update `e2e/tests/golden-paths.spec.ts` — no `/today` route; the golden path starts at `/planner`.
- Update `e2e/tests/planner-canvas.spec.ts`, `planner-fill-week.spec.ts`, `planner-repair.spec.ts` — new calendar selectors (heatmap cells, no orange today-pill).
- A11y: verify the heatmap cells expose day + load via `accessibilityLabel` (REQ-043 / ADR-0062); the color is decorative, the label carries the meaning.

## Acceptance criteria

- [ ] `feierabend.spec.ts` passes on `/planner` Day view
- [ ] `golden-paths.spec.ts` passes with no `/today` route
- [ ] Planner E2E specs pass with the new heatmap selectors
- [ ] A screen-reader audit (axe or manual) confirms every heatmap cell announces day + load
- [ ] No a11y regression vs. the old number-grid (which already had labels)
- [ ] `./test.sh` passes

## Blocked by

- #365 (Today tab retired — routes changed)
- #366 (PlannerMonth heatmap — new selectors)
- #367 (PlannerYear heatmap — new selectors)
