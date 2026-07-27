# Grilling Results — Unified Day Canvas & Calendar Modernization

> Grill session: 2026-07-24 · Plan: [`unified-day-canvas-and-calendar-modernization.md`](unified-day-canvas-and-calendar-modernization.md)
> Method: [`grill-with-docs`](../skills/skills/ultimate-dev-process/skills/engineering/grill-with-docs/SKILL.md) — stress-test every decision against the project's ADRs and docs.

---

## Findings

### 1. ADR-0063 conflict — CRITICAL, resolved

[`ADR-0063`](../docs/adr/0063-calendar-centric-ia.md) established exactly **four places**: Today ·
Planner · Projects · Reports ([point 1](../docs/adr/0063-calendar-centric-ia.md)). Retiring the
Today tab **supersedes** this. The new ADR-0075 must explicitly supersede ADR-0063's four-places
model with a **three-places** model (Planner · Projects · Reports + Profile avatar).

**Resolution:** ADR-0075 supersedes ADR-0063 point 1. ADR-0063 point 4 ("routes are unchanged") is
**preserved** — the `/today` route stays as a redirect to `/planner`, so deep links, OS quick
actions (REQ-039), and the command bar keep working. The [`Screen`](../packages/design/src/nav.ts:10)
type keeps `'today'` for deep-link compatibility.

### 2. ADR-0072 alignment — no conflict, extends

[`ADR-0072`](../docs/adr/0072-planner-daily-loop.md) already moved the drift chip / day repair
into the Planner Day view (D1: "the existing drift chip *becomes the action* — on Today and in the
planner's day view") and established "Ruhe als Default" (D3). Our plan extends this — the hero
tracker + Feierabend ritual landing in the Planner Day view is the natural completion of ADR-0072's
"the day stage of the Planner."

**Resolution:** ADR-0075 extends ADR-0072. No conflict. Cite ADR-0072 as the foundation.

### 3. ADR-0005 (deterministic core) — no conflict, confirmed

[`ADR-0005`](../docs/adr/0005-deterministic-core.md) requires every number to come from pure,
tested logic. The merge moves only **view code** — the pure logic
([`todayShutdown`](../apps/mobile/src/today/shutdown.ts:52),
[`shutdownSummary`](../packages/domain),
[`dayLoad`](../packages/design/src/projects.ts),
[`loadTone`](../packages/design/src/projects.ts)) stays in `packages/domain` / `packages/design`.

**Resolution:** ADR-0075 states explicitly: only presentation moves; the deterministic core is
untouched. The heatmap's 5-step scale is driven by the existing pure [`loadTone`](../packages/design/src/projects.ts)
— no new computation.

### 4. `live` orange semantics — correction, not a new rule

The [`palette.ts`](../packages/design/src/palette.ts:67) doc already states: `live` means "something
is happening right now (running timer, now-line, REC dot, logo playhead). Never decorative." The
calendar currently **violates** this — [`PlannerMonth`](../apps/mobile/src/components/planner/PlannerMonth.tsx:164)
uses `live` orange for the today-pill, and [`PlannerYear`](../apps/mobile/src/components/planner/PlannerYear.tsx:56)
uses it for the "NOW" border. These are decorative, not "happening now."

**Resolution:** The redesign fixes this by using the **accent blue** for calendar heat. This is a
correction back to the palette's own rule, not a new rule. ADR-0075 notes this.

### 5. ADR-0068 (FullCalendar on web) — no conflict, stays in place

[`ADR-0068`](../docs/adr/0068-design-v20-fullcalendar-web-planner-reduktionspass.md) put the
calendar mechanics on FullCalendar for the **web timegrid** (Day/Week views). The calendar redesign
touches [`PlannerMonth`](../apps/mobile/src/components/planner/PlannerMonth.tsx:52) and
[`PlannerYear`](../apps/mobile/src/components/planner/PlannerYear.tsx:33) — the native + fallback
month/year views, **not** the FullCalendar web timegrid.

**Resolution:** ADR-0068 stays in place. ADR-0075 notes that the redesign is scoped to the
month/year surfaces; the FullCalendar web timegrid is untouched.

### 6. Nav model — confirmed, tests must update

[`PHONE_TABS`](../packages/design/src/nav.ts:67) drops from 5 to 4 items
(`planner · projects · reports · profile`).
[`SIDEBAR_ITEMS`](../packages/design/src/nav.ts:78) drops from 4 to 3
(`planner · projects · reports`). The [`Screen`](../packages/design/src/nav.ts:10) type keeps
`'today'` (deep-link route preserved as redirect). The nav tests
([`nav.test.ts`](../packages/design/src/nav.test.ts)) must be updated to assert the new counts.

**Resolution:** ADR-0075 records the nav-model change. The implementation ticket updates the tests.

---

## Aspects that passed (no blockers found)

- **Shared timer (ux-vision §2.3):** one [`TimerContext`](../apps/mobile/src/timer/TimerContext.tsx),
  one [`useWorktime`](../apps/mobile/src/hooks/useWorktime.ts) — the merge moves controls, not state.
  No second clock. ✅
- **Co-Planner plan blocks:** shared via [`usePlanner`](../apps/mobile/src/hooks/usePlanner.ts) on
  both surfaces — unchanged. ✅
- **A11y (REQ-043 / ADR-0062):** the heatmap cells keep `accessibilityLabel` with day + load; color
  is decorative. ✅
- **TDD (§3 of the process):** each step ships with its test first. The pure logic is already
  tested; the new components get render tests. ✅
- **Conventional Commits (§5):** one logical change per PR, `Closes #NNN` linking. ✅

---

## Outcome

**No blockers.** The plan proceeds to ADR-0075 and ticket creation. The one critical finding
(ADR-0063 supersession) is resolved by making ADR-0075 an explicit supersession of ADR-0063 point 1.
