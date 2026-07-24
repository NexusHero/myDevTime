# ADR 0075: Unified Day Canvas — retire the Today tab, modernize the calendar

## Status

Accepted (owner decision, grill session 2026-07-24) — **supersedes [ADR-0063](0063-calendar-centric-ia.md)
point 1** (the four-places model → three-places model). **Extends [ADR-0072](0072-planner-daily-loop.md)**
(the planner daily loop — the Day view as the day stage) and **[ADR-0068](0068-design-v20-fullcalendar-web-planner-reduktionspass.md)**
(FullCalendar on web — stays in place, untouched). **Bound by [ADR-0005](0005-deterministic-core.md)**
(deterministic core: only presentation moves; the pure `todayShutdown` / `shutdownSummary` / `dayLoad`
/ `loadTone` logic stays in `packages/domain` / `packages/design`, exhaustively tested). Extends the
Co-Planner of ADR-0011 and the calm-canvas work of ADR-0072 D3.

## Context

The client ships two top-level tabs for the daily loop — **Today** and **Planner** — split across
[`PHONE_TABS`](../packages/design/src/nav.ts:67) (`today · planner · projects · reports · profile`).
ADR-0063 established this as the "four places" (Today · Planner · Projects · Reports), with the
calendar (Today's Day Canvas + the Planner week) as the centre of gravity.

The owner's honest verdict: the split **scatters the daily loop**. Today owns the best *tracking* UX
— the hero [`LiveButton`](../apps/mobile/src/components/canvas/LiveButton.tsx:73) (breathing + pulse
waves), the [`PauseCounter`](../apps/mobile/src/components/canvas/PauseCounter.tsx:21), the billable
€ toggle, the worked-time display, the [`shutdownCard`](../apps/mobile/src/screens/TodayScreen.tsx:938)
Feierabend ritual (`git commit -m "Feierabend"`), and the booked-time-on-stop summary. Planner owns
the best *planning* canvas — the week/month/year grid, the Co-Planner ghosts, the reality layer.
Splitting them means you plan in one place, track in another, and close the day in a third.

Meanwhile [ADR-0072](0072-planner-daily-loop.md) already moved the day-repair drift chip and the
calm-canvas work into the Planner Day view — the merge is the natural completion of "the day stage
of the Planner." The Planner already has a `Day` view with a small
[`PlannerDayTracker`](../apps/mobile/src/components/planner/PlannerDayTracker.tsx:28); elevating it
into the full tracking home removes the split without losing any capability.

Separately, the calendar's month/year views look dated:
[`PlannerMonth`](../apps/mobile/src/components/planner/PlannerMonth.tsx:52) uses warm amber
(`warn` `#d9903f`) for load bars and `live` orange (`#ff6b3d`) for the today-pill;
[`PlannerYear`](../apps/mobile/src/components/planner/PlannerYear.tsx:33) uses `live` orange for the
"NOW" border. The [`palette.ts`](../packages/design/src/palette.ts:67) doc already states `live`
means "happening right now — never decorative" — the calendar's use of it is a violation of the
palette's own rule. The design system ships a modern Sovereign royal-blue accent (`#3654E0`) and a
calm neutral palette that the calendar barely uses.

## Decision

### D1 — Retire the Today tab; three places + an avatar

The rail becomes **three places**: Planner · Projects · Reports. Profile stays as the avatar footer
(phone: fourth bottom tab).

- [`PHONE_TABS`](../packages/design/src/nav.ts:67) becomes `planner · projects · reports · profile`
  (4 tabs, down from 5).
- [`SIDEBAR_ITEMS`](../packages/design/src/nav.ts:78) becomes `planner · projects · reports`
  (3 places, down from 4).
- The [`Screen`](../packages/design/src/nav.ts:10) type **keeps** `'today'` — the `/today` route
  stays as a redirect to `/planner`, so deep links, OS quick actions (REQ-039), and the command bar
  keep working (ADR-0063 point 4, "routes are unchanged," is preserved).
- The Planner's `Day` view becomes the default landing view (currently opens on `Week`).

This **supersedes ADR-0063 point 1** (the four-places model). ADR-0063 points 2–5 (Profile as avatar,
Meetings/Absence/Assistant folded into the calendar, routes unchanged, progressive disclosure) all
**stand unchanged**.

### D2 — Extract the hero tracker + Feierabend into reusable components

The entire [`heroBar`](../apps/mobile/src/screens/TodayScreen.tsx:256) (task input, project chip,
billable € toggle, worked-time display, [`PauseCounter`](../apps/mobile/src/components/canvas/PauseCounter.tsx:21),
big orange breathing [`LiveButton`](../apps/mobile/src/components/canvas/LiveButton.tsx:73)) and the
[`shutdownCard`](../apps/mobile/src/screens/TodayScreen.tsx:938) (Feierabend summary + `git commit -m
"Feierabend"` button) become reusable components (`HeroTrackerBar`, `ShutdownCard`), consumed by the
Planner Day view. The [`PlannerDayTracker`](../apps/mobile/src/components/planner/PlannerDayTracker.tsx:28)
is **removed** — the `HeroTrackerBar` fully replaces it.

Only **view code** moves. The pure logic — [`todayShutdown`](../apps/mobile/src/today/shutdown.ts:52),
[`shutdownSummary`](../packages/domain), [`dayLoad`](../packages/design/src/projects.ts),
[`loadTone`](../packages/design/src/projects.ts) — stays in `packages/domain` / `packages/design`,
untouched (ADR-0005). The shared timer ([`TimerContext`](../apps/mobile/src/timer/TimerContext.tsx))
and punch clock ([`useWorktime`](../apps/mobile/src/hooks/useWorktime.ts)) are unchanged — the merge
moves controls, not state. No second clock (ux-vision §2.3).

### D3 — Redesign the calendar: heatmap, not grid

The month/year views move from a number-grid to a **card-based heatmap**:

- **5-step accent-blue heat scale** (idle `bg` → `sunk` → `accentSoft` → `accentText` → `accent`),
  driven by the existing pure [`loadTone`](../packages/design/src/projects.ts) — no new computation.
- **Borderless rounded cells** (`radius.block`, `gap` between cells) instead of hard hairline
  borders.
- **Quiet day numbers** (`ink3`, small); the *fill intensity* is the primary signal. Today wears a
  subtle accent ring (border), not a loud orange pill.
- **`live` orange is corrected** back to its semantic scope (running timer / now-line only) per
  [`palette.ts`](../packages/design/src/palette.ts:67). The calendar overview uses the accent blue
  for load/heat — calm, not alarming.
- The booking-gap marker keeps its hollow ring but switches from `warn` to `ink3` (information, not
  a warning).

This touches [`PlannerMonth`](../apps/mobile/src/components/planner/PlannerMonth.tsx:52) and
[`PlannerYear`](../apps/mobile/src/components/planner/PlannerYear.tsx:33) — the native + fallback
month/year surfaces. [ADR-0068](0068-design-v20-fullcalendar-web-planner-reduktionspass.md)'s
FullCalendar web timegrid (Day/Week) is **untouched**.

### D4 — Move the Today-only companions into the Planner Day view

[`SeviWatch`](../apps/mobile/src/components/today/SeviWatch.tsx),
[`EveningCompanionCard`](../apps/mobile/src/components/today/EveningCompanionCard.tsx), and
[`MoodEaseCard`](../apps/mobile/src/components/today/MoodEaseCard.tsx) move into the Planner Day
view, below the `ShutdownCard` — keeps the whole day-close ritual in one place (owner decision,
Option A).

## Consequences

- **Nav tests** ([`nav.test.ts`](../packages/design/src/nav.test.ts)) update to assert the new
  `PHONE_TABS` (4) and `SIDEBAR_ITEMS` (3) counts, and the `/today` → `/planner` redirect.
- **E2E specs** update: [`feierabend.spec.ts`](../e2e/tests/feierabend.spec.ts) now runs on
  `/planner` Day; [`golden-paths.spec.ts`](../e2e/tests/golden-paths.spec.ts) drops the `/today`
  route; the planner specs update for the new calendar selectors.
- **A11y (REQ-043 / [ADR-0062](0062-accessibility-baseline-approach.md)):** the heatmap cells keep
  `accessibilityLabel` with day + load; color is decorative, the label carries the meaning.
- **`PlannerDayTracker` removed** — no dead code; the `HeroTrackerBar` is the single tracker surface
  on the Planner Day view.
- **Risks accepted:** the heatmap is less precise than inline numbers (mitigated: numbers available
  on tap/long-press; the overview prioritizes *pattern* over *precision* — the Week/Day canvas is
  for precision). Losing the Today tab's focused "just track" flow is mitigated by the Planner Day
  view *being* that flow — hero tracker on top, canvas below, Week/Month/Year one tap away.

## Alternatives considered

1. **Keep two tabs but share components** — rejected. The split itself is the problem; sharing
   components across two tabs still forces a context switch to close the day.
2. **Fold the companions into the Assistant overlay (ADR-0063 H3)** — rejected by the owner. The
   companions are part of the day-close ritual; keeping them on the Day view (below the Feierabend
   card) preserves the ritual in one place. The Assistant overlay stays for conversational moments.
3. **3-step heat scale (calm/normal/heavy)** — rejected. The 5-step scale mirrors the existing
   [`loadTone`](../packages/design/src/projects.ts) bands and gives finer granularity at no extra
   computational cost (the pure function already produces the bands).

## Requirements

REQ-075 (unified day canvas — retire Today tab, merge hero tracker + Feierabend into Planner Day) ·
REQ-076 (calendar heatmap modernization) — see the register in `docs/architecture.md`.
