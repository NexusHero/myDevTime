# ADR 0063: Calendar-centric IA — four places + an avatar; secondary surfaces fold into the calendar

## Status

Accepted (owner decision) — supersedes the fixed information-architecture of
**ux-vision §3** (the "five tabs / seven-item sidebar" model) after the v12
design-system handoff reworked the IA around one idea: *the calendar is the living
place.* Extends ADR-0011 (Co-Planner / design language) and the app-shell nav model
(#11); bound by ADR-0005 (AI proposes, never acts).

## Context

The client shipped seven nav destinations: Today, Planner, Projects, Reports,
Meetings, Assistant, and Profile — the four "places" plus three secondary surfaces
promoted onto the tablet/desktop sidebar (Meetings, Assistant, Absence) and reached on
the phone through the Profile hub. Profile itself was a peer nav item.

The v12 handoff (`DESIGN_BACKLOG.md` §H "IA-Umbau — Kalender ist der Lebensort")
found this dilutes the product's one differentiator. A meeting, an absence, and a
booked task are all just **blocks on the day** — giving each its own tab pulls the user
*away* from the calendar to act *on* time that lives *in* the calendar. The Assistant,
likewise, is something you invoke over the screen you're on, not a room you travel to.

## Decision

Adopt a **four-places-plus-avatar** IA. This ADR lands the structural nav change
(H1); the drawer (H2) and overlay (H3) it points to ship as their own PRs.

1. **The rail is the four places only:** Today · Planner · Projects · Reports.
   `SIDEBAR_ITEMS` becomes exactly these four. The calendar (Today's Day Canvas +
   the Planner week) is the centre of gravity.
2. **Profile is "me", not a place.** The tablet/desktop sidebar pins it as an
   **avatar in the footer** (initials + name, below the docked Island), not a rail
   item. The phone keeps it as the fifth bottom tab (`PHONE_TABS` unchanged) — a
   thumb-reachable tab still beats a top-corner avatar on a small screen.
3. **Meetings, Absence and the Assistant stop being destinations.** Their content
   moves *into* the calendar: a **typed entry drawer** on Planner blocks (Meeting,
   Task/Booked, Ghost, Pause, Absence, Event — H2) and an **Assistant overlay** invoked
   by `✦`/`⌘K` (H3). Until those land, the surfaces stay reachable via the Profile hub,
   the command bar, and their deep-link routes — no surface is orphaned (the nav test
   asserts this).
4. **Routes are unchanged.** Every `Screen` keeps its deep-link route (`/meetings`,
   `/assistant`, `/profile/absences`, …) so the AI, OS quick actions (REQ-039), and the
   command bar can still link straight in. Only the *rail membership* changed.
5. **Progressive disclosure (H4)** is the accompanying rule: invoicing UI appears once a
   client has a rate; the absence-balance card after the first absence entry — recorded
   here as direction, realized incrementally.

## Consequences

- **Pros**: the calendar is unmistakably the product's home; the rail is calmer (four
  items, novelty spent on the canvas per ux-vision §5); Profile reads as an account
  affordance, matching platform convention. No routes lost — deep links and the command
  bar keep everything reachable.
- **Cons / migration**: the drawer (H2) and overlay (H3) must land for Meetings/Absence/
  Assistant to feel *native* to the calendar rather than merely reachable via the hub;
  until then those surfaces are a click deeper on desktop than before. Tracked as the
  follow-up PRs of this v12 work (the app-shell IA rides on #11 / REQ-007's responsive
  shell — no new requirement, a refinement of the existing one).
- **Docs**: ux-vision §3 is rewritten to this model and §2.6 (reality layer) added;
  this ADR is the decision of record. The nav model (`packages/design/src/nav.ts`) and
  its tests encode the four-places invariant.
