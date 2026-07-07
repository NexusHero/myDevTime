# ADR 0013: Competitive Adoption Round 2 — Notes, Month Overview, Burn-Down, System Quick Actions, Classic List, Zeitausgleich

## Status

Accepted — extends the 1.0 scope union (ADR-0002/0008/0010/0011/0012). (The pricing ADR from
#29 moves to the next free number.)

## Context

Second owner-led competitive screenshot review (2026-07-07): Flexishift (location/Siri/Shortcuts
clock-in), TIIME (month grid with activity dots, money burn-down with ø/day, classic timeline
list, entry comments), TimeTrack/Chronos (week list with per-entry amounts, invoicing, expense
tracking with receipt photos), Clockodo-style manual entry (Zeit/Pauschale/Abwesenheit tabs),
and an attendance app with a prominent time account and absence **approval states** incl.
**Compensatory Time off**.

Findings split three ways: gaps we must close in 1.0 (a missing **note field** is the biggest —
the note is the timesheet position text), habit/trust features worth adopting now, and
confirmations for existing post-1.0 backlog items (invoicing, geofencing).

## Decision

1.0 gains five requirements plus one scope clarification:

- **REQ-036 Entry notes** (#46): description on every entry (incl. the running timer), flowing
  into timesheet position texts, search, and exports.
- **REQ-037 Month overview** (#47): activity dots per day + deterministic booking-gap markers.
- **REQ-038 Budget burn-down** (#48): remaining-over-time chart with explainable run-rate
  forecast ("erschöpft ~21.7.") from the deterministic core.
- **REQ-039 System quick actions** (#49): iOS App Intents (Siri/Shortcuts/Spotlight) + Android
  Quick Settings Tile over a shared headless action layer — the gateway to widgets/watch.
- **REQ-040 Classic day list** (#50): Canvas ⇄ Liste toggle with per-entry amounts and day
  subtotals; the list is the accessibility-first path.
- **Zeitausgleich** (compensatory time off) becomes a first-class absence type in REQ-029/#37:
  a comp-time day debits the overtime balance instead of the vacation allowance.

Confirmed as post-1.0 backlog (documented, not adopted): **expense tracking with receipt
photos**, **invoice generation** (both billing depth), **absence approval workflow**
(Teams), **geofence auto-punch** (already listed).

## Consequences

- M1 gains #46 (model/API), M2 gains #47–#50 — the schedule absorbs mostly UI-layer work; the
  only new native surface is #49, whose feasibility rides on the existing client spike (#1).
- The note field touches many features (exports, search, NL entry, assistant grounding) — hence
  a requirement of its own rather than a checkbox on #8.
- The classic list doubles as the accessibility statement for the product: full parity is a
  hard acceptance criterion, which protects the canvas from becoming an exclusionary showpiece.
- Forecasts (burn-down) enter user-visible territory: explainability rules (window + rate shown,
  no forecast below a data threshold) prevent fake precision — same discipline as the AI layer.
- This is the second scope-growth ADR in two days; the owner accepts that 1.0 is now a big bet.
  Anything further should displace, not add — the next scope ADR must name what moves out.
