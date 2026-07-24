# QA Acceptance Plan — Unified Day Canvas & Calendar Modernization

> **Owner:** Salih (QA / Test Engineer)
> **Date:** 2026-07-24
> **Plan:** [`plans/unified-day-canvas-and-calendar-modernization.md`](unified-day-canvas-and-calendar-modernization.md)
> **ADR:** [`ADR-0075`](../docs/adr/0075-unified-day-canvas-calendar-modernization.md)
> **Process:** [`ultimate-dev-process` §3 (Testing) + §7 (Definition of Done)](../skills/skills/ultimate-dev-process/SKILL.md)

---

## Salih's role

Salih owns the **test strategy shape** (the pyramid), **test quality** (not just coverage %), and the
**acceptance/e2e tests**. Per the process §7, every delivered requirement carries an **acceptance-tier
test** — exercised end-to-end against the real system. A requirement reaching Done without one is
**not done**.

Salih must:
1. Run `./test.sh` before any PR merges — this is the local gate, same as CI.
2. Click through the acceptance scenarios below on the real render target (web + native if possible).
3. Verify the tests assert **behaviour**, not just execute lines (§6 Reviewer Protocol, perspective 5).

---

## Acceptance scenarios (click-through)

### A. The merged Day Canvas (issues #361–#365)

#### A1 — The hero tracker lives on the Planner Day view
- [ ] Open `/planner` — it lands on the **Day** view (not Week).
- [ ] The big orange [`LiveButton`](../apps/mobile/src/components/canvas/LiveButton.tsx:73) is visible
      at the top of the Day view.
- [ ] The task input, project chip, billable € toggle, and worked-time display are all present.
- [ ] The [`PauseCounter`](../apps/mobile/src/components/canvas/PauseCounter.tsx:21) appears when
      paused.

#### A2 — Start / Pause / Stop works on the Planner Day view
- [ ] Tap Start → the button breathes + emits pulse waves (reduced-motion: static).
- [ ] The worked-time counter ticks up in live-orange.
- [ ] Tap Pause → the counter freezes, the PauseCounter (warn) stacks under it and climbs.
- [ ] Tap Resume → the counter resumes, the PauseCounter disappears.
- [ ] Tap Stop → the toast fires: `Timer stopped — X tracked.` (the snapshot is correct).
- [ ] The [`PlannerDayTracker`](../apps/mobile/src/components/planner/PlannerDayTracker.tsx) is
      **gone** — no dead code, no second tracker row.

#### A3 — Clock-in / clock-out (Ausstempeln) works
- [ ] The Clock in/out button is present on the hero bar.
- [ ] Clock in → toast `Clocked in.`
- [ ] Clock out → toast `Clocked out.`

#### A4 — The Feierabend ritual works on the Planner Day view
- [ ] The [`ShutdownCard`](../apps/mobile/src/screens/TodayScreen.tsx:938) renders below the day
      canvas (when there is real tracked/booked time).
- [ ] It shows Booked / Tracked reality / Still open figures.
- [ ] The `git commit -m "Feierabend"` button is present.
- [ ] Tapping it closes the day (local state — no fabricated backend state).
- [ ] The "Tomorrow starts with X" line renders when tomorrow has a first planned block.
- [ ] The card is **hidden** when the day is idle (nothing tracked or booked).

#### A5 — The companions moved to the Planner Day view
- [ ] [`SeviWatch`](../apps/mobile/src/components/today/SeviWatch.tsx),
      [`EveningCompanionCard`](../apps/mobile/src/components/today/EveningCompanionCard.tsx), and
      [`MoodEaseCard`](../apps/mobile/src/components/today/MoodEaseCard.tsx) render below the
      `ShutdownCard` on the Planner Day view.

#### A6 — The Today tab is retired
- [ ] The bottom tabs (phone) are: Planner · Projects · Reports · Profile (4, not 5).
- [ ] The sidebar (desktop) is: Planner · Projects · Reports (3, not 4).
- [ ] Navigating to `/today` redirects to `/planner`.
- [ ] Deep links, the command bar, and OS quick actions that point at `today` still work (redirect).
- [ ] No surface is orphaned — every `Screen` is reachable.

---

### B. The calendar heatmap (issues #366–#367)

#### B1 — Month view is a heatmap, not a number-grid
- [ ] Month cells are borderless rounded rectangles with gap spacing (no hairline borders).
- [ ] Each day cell's background is a **5-step accent-blue** fill (idle → sunk → soft → text → accent)
      driven by the day's load.
- [ ] The 3px amber load bar is **gone** — the fill IS the load signal.
- [ ] Today wears an **accent ring** (border), not an orange `live` pill.
- [ ] Day numbers are quiet `ink3`, small.
- [ ] The booking-gap marker is `ink3` (not `warn` amber).
- [ ] The inline load number is hidden by default (available on tap/long-press).
- [ ] Task chips remain legible above the heat fill.

#### B2 — Year view is unified with the month view
- [ ] The current month wears an accent ring (not a `live` orange "NOW" border).
- [ ] The "NOW" label is accent-colored.
- [ ] The 5-step scale matches the month view exactly.
- [ ] The `loadHeat` helper is shared (one function, consumed by both views).

#### B3 — Accessibility (REQ-043 / ADR-0062)
- [ ] Every heatmap cell exposes an `accessibilityLabel` with day + load (e.g. "15 — 6.5 hours").
- [ ] A screen reader announces the day and load — the color is decorative, the label carries meaning.
- [ ] No a11y regression vs. the old number-grid (which already had labels).
- [ ] Run axe (or equivalent) — zero new violations.

---

### C. E2E + test gate (issue #368)

#### C1 — E2E specs pass
- [ ] [`feierabend.spec.ts`](../e2e/tests/feierabend.spec.ts) passes on `/planner` Day view.
- [ ] [`golden-paths.spec.ts`](../e2e/tests/golden-paths.spec.ts) passes with no `/today` route.
- [ ] [`planner-canvas.spec.ts`](../e2e/tests/planner-canvas.spec.ts) passes with new heatmap selectors.
- [ ] [`planner-fill-week.spec.ts`](../e2e/tests/planner-fill-week.spec.ts) passes.
- [ ] [`planner-repair.spec.ts`](../e2e/tests/planner-repair.spec.ts) passes.

#### C2 — The full gate is green
- [ ] `./test.sh` passes (lint + typecheck + unit + integration + coverage ≥90% on core + docs check).
- [ ] No tests are skipped.
- [ ] No blanket suppressions added without justification.

---

## Per-PR QA checklist (Salih runs before approving merge)

For each PR (#361–#368), Salih verifies:

- [ ] **Build succeeds; strict/lint pass** with zero unjustified suppressions.
- [ ] **All tests green, none skipped.**
- [ ] **New behavior has a test written before the implementation** (TDD — §3.1).
- [ ] **Coverage on core logic stays ≥90%** (§3.4).
- [ ] **Acceptance-tier test exists** for the requirement (§7) — for UI changes, a render test or E2E.
- [ ] **SOLID holds** — no god classes, dependencies through interfaces (§2.1).
- [ ] **No secrets/PII committed.**
- [ ] **ADR-0005 holds** — only view code moved; the deterministic core is untouched.
- [ ] **Conventional Commits** — `feat(scope): summary`, `Closes #NNN` (§5).
- [ ] **One logical change per PR** (§6).
- [ ] **Anything found along the way that's out of scope has its own issue** — not silently fixed (§6).
- [ ] **`git status` clean** — no untracked files the change depends on (§7).

---

## Sign-off

Salih does **not** approve merge until:
1. `./test.sh` is green.
2. The acceptance scenarios above are clicked through and pass.
3. The per-PR checklist is complete.

Only then does the PR merge. This is the agile-but-safe approach Matthias asked for.
