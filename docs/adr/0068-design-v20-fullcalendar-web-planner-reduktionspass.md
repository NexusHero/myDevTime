# ADR 0068: Design v20 — FullCalendar for the web Planner, RN grid on native, Reduktions-Pass header

## Status

Accepted (owner decision) — realizes the **design v20** handoff. **Bound by ADR-0004**
(one Expo/React-Native codebase for iOS + Android + Web) and **ADR-0005** (deterministic
core: every number the calendar shows is computed in `packages/domain`; the library only
lays out and renders what the core produced). Extends the Planner of ADR-0063
(calendar-centric IA) and the Month/Year views of the v18 work. Supersedes nothing.

## Context

The v20 handoff makes the calendar mechanics a **binding** technical directive
(`HANDOFF_PROMPT.md:47`):

> "**Kalender-Mechanik (Tech-Empfehlung, verbindlich): FullCalendar** (Plugins: timegrid,
> dayGrid, multiMonth, interaction — alle MIT-frei) für Tag/Woche/Monat/Jahr, Scrolling,
> Drag/Resize, Kollisions-Layout, DST/Touch-Edge-Cases; react-big-calendar nur als Fallback.
> Das Rendering kommt 1:1 aus unseren Mocks via Custom-Event-Renderer … NIEMALS das
> Default-Theme der Lib ausliefern. Das Grid nicht von Hand bauen."

Plus the v20 **Reduktions-Pass** (`HANDOFF_PROMPT.md:45`): the Planner header carries only
zoom (Day/Week/Month/Year) + a "View" popover (layer filter + Reality toggle) + KW
navigation on the left, and Capacity · Inbox · ✦ Fill week · + New on the right — no other
controls in the head.

The tension: **FullCalendar is a DOM-only library** (it mounts into DOM nodes, ships CSS,
and uses `@fullcalendar/react` over `react-dom`). Our client is one Expo/RN codebase
(ADR-0004) that renders to real DOM **only on the web target** (react-native-web); on
iOS/Android there is no DOM, so FullCalendar cannot run there. A naïve dependency would
break the native builds.

## Decision

1. **FullCalendar on the web target only, behind a platform split.** The Planner's calendar
   surface is `PlannerCalendar` with two implementations resolved by Metro's platform
   extensions:
   - `PlannerCalendar.web.tsx` — mounts `@fullcalendar/react` with the MIT plugins
     (`daygrid`, `timegrid`, `multimonth`, `interaction`) for Day/Week/Month/Year, scrolling,
     drag/resize and collision layout.
   - `PlannerCalendar.tsx` (native + the default for tests) — keeps the existing
     hand-built RN grid (`PlannerMonth`/`PlannerYear` over `@mydevtime/design`'s pure
     `monthGrid`), which already ships and is tested.
   There is one precedent for this split already (`ReanimatedTimer.web.tsx`).

2. **Custom event renderers, never the library theme.** Events render 1:1 from our mocks via
   FullCalendar's `eventContent` — ghost (dashed), life (sage `--life`), req (hatch), the
   reality trace, the orange now-line and the capacity trace. The library's default CSS is
   overridden to our tokens; we never ship its stock theme.

3. **The data stays deterministic (ADR-0005).** FullCalendar receives already-computed events
   (occurrences from the `recurrence` core, load/capacity from `packages/domain`); it lays
   them out and reports interactions (drag/resize/create) back as intents the deterministic
   core resolves. The library computes **no** number that reaches a timesheet, budget or
   invoice.

4. **react-big-calendar is not adopted** (the handoff's fallback): FullCalendar's plugins
   are all MIT, cover the year view and have stronger touch DnD; a fallback is unnecessary.

5. **Reduktions-Pass header** — the layer filter + Reality toggle move into one "View" popover
   (`PlannerViewMenu`, already landed); the header keeps only zoom, View, KW navigation, and
   the primary actions.

## Consequences

- **Native keeps working.** iOS/Android never import FullCalendar; they render the RN grid.
  The `./test.sh` gate and Vitest resolve the base `.tsx`, so the suite is unaffected by the
  web-only dependency; typecheck covers the `.web.tsx` against the installed FullCalendar types.
- **Web parity with the mocks** (real scrolling, drag/resize, collision layout, DST edge-cases)
  without hand-building a grid — the directive's intent.
- **New web-only dependencies** (`@fullcalendar/*`, MIT). They are bundled only in the web
  export, verified there; the OSV/dependency-review CI jobs cover licence + advisories.
- **Two calendar implementations to keep in visual sync.** Mitigated by both consuming the same
  deterministic event/occurrence model and the same design tokens; the RN grid stays the
  source of truth for the render tests.
- The web calendar's on-device/browser verification is a manual check (the gate does not build
  the Expo web bundle); tracked as residual, like the ADR-0004 on-device checklist.
