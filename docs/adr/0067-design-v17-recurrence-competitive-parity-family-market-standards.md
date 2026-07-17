# ADR 0067: Design v17 — recurring entries, competitive parity, family-market standards

## Status

Accepted (owner decision) — **extends ADR-0066** (design v14 two-worlds/roles/protection/health)
and ADR-0065 (v13). Bound by ADR-0005 (deterministic core; AI proposes, the user books),
ADR-0029 (the one grounded LLM port), ADR-0027 (entitlements/credits), and the consent-first
capture rule (REQ-025). Realizes the v17 handoff: §F4 recurring entries, §K competitive parity
(KI6/K3/K4/K5), §F6 family-market standards, and the binding shield-icon rule.

## Context

The v17 handoff carries the v14 pillars forward and adds a competitive-parity wave (market
research July 2026: Timely, Rize, Toggl, Clockify, Reclaim, Sunsama) plus the family-market
standards (Cozi, TimeTree, Skylight, Calendara). As before, everything lands **without mock
data**, in **English**, and **anything not yet backend-backed becomes a requirement with
acceptance tests** rather than a fake. The non-negotiables stand: deterministic numbers in
`packages/domain`; the LLM only proposes/phrases with provenance and credits; workspace
isolation; consent-first capture; anti-surveillance (no screenshots, no GPS, no force-timers).

The v17-new pillars, and why each needs a decision:

- **§F4 Recurring entries** — series are a **core** feature for *every* entry type (a daily
  standup, a weekday commute, football on Tuesdays), not a family extra. A rule is a frequency
  (none / daily-weekdays / weekly / monthly) plus an end (never / until / count); editing "this
  vs the series from here" follows the **Outlook convention** (split the series, don't invent a
  new model). The Co-Planner treats a series as **hard** (Fill-week fills around it).
- **§K Competitive parity** — (KI6) **Timesheet drafts**: the auto-tracker's reality becomes a
  violet, Pro review-queue on Today ("your day, already written"), **never auto-booked**; (K3)
  **calendar↔timer trigger**: a linked meeting starts its timer (orange/deterministic), and the
  Island asks **once** at the end; (K4) **plan-vs-realized revenue** chip on fixed-fee projects
  in Reports; (K5) **shutdown ritual**: a Today "close the day" flow (booked / reality / open /
  tomorrow-first + a `git commit -m "Feierabend"` CTA). Browser-extension timers (K2) are a
  platform spec, not design. **Explicitly not built** (market-validated): screenshots, GPS,
  force-timers, kiosk, team-approvals — anti-surveillance is the honesty brand.
- **§F6 Family-market standards** — color per person (2–3 `--life` shades, **no** new rainbow
  palettes); a **one-link** partner invite yielding a free **partner-light** view (calendar +
  requests only); Google/Apple calendar sync alongside Outlook (same Stufe 1/2 mechanics); (KI5)
  a violet, Pro **photo/mail import** (a school schedule photo → ghost series to confirm, never
  auto); and a **Work / Life / Both** layer filter in the planner header (default Both, never a
  new tab). `FAMILY_SPEC.md` in the design system is the source of truth for the family layer.
- **Shield-icon rule** — the 🛡 emoji renders in colour and breaks the icon language; the UI must
  use a **stroke-shield SVG** (Lucide style, `currentColor`, strokeWidth 2–2.4) everywhere the
  protection flag surfaces. 🛡 as shorthand in docs/text is fine.

## Decision

Deliver v17 as a sequence of focused changes, deterministic cores first, exactly as v13/v14 were.
This ADR records the decisions; each slice keeps the Requirements Register and traceability
current in its own PR.

### §F4 Recurrence — the deterministic core (this slice, REQ-060)

`packages/domain/src/recurrence/recur.ts` is pure and framework-free (ADR-0005), operating on
`YYYY-MM-DD` date strings (a calendar day is the unit — no clock, no timezone):

- `RecurrenceRule` = `{ freq: none|daily|weekly|monthly, end: never|until|count }`; `daily` means
  **every weekday** (the §F4 "täglich (werktags)" option).
- `expandRecurrence(rule, start, from, to)` lists the occurrence dates in `[from, to]`, honouring
  the end. **Monthly skips short months** (a 31st never drifts to the 1st/28th), capped at
  `MAX_STEPS` so no window loops unbounded.
- `isOccurrence` (does the series land on a date), `truncateBefore` (the "series from here" split
  — end the original series the day before, Outlook-style), and `describeRecurrence` (the ↻ row's
  plain-English label).

### Deferred, with acceptance criteria (follow-up slices)

Everything below is **not yet backend-backed**; it is a requirement now and ships with an
acceptance-tier test when built:

1. **§F4 recurrence persistence + drawer ↻ row** — the `RecurrenceRule` on an entry, the drawer's
   "↻ Repeat" row, the this-vs-series edit prompt, and Fill-week treating a series as hard.
   *Acceptance:* an integration test that a weekly series materialises its occurrences and that
   Fill-week places no work over them.
2. **§K KI6 timesheet drafts** — a deterministic span→draft-entry builder over the auto-tracker
   reality (recovered-time counter), the LLM phrasing titles (violet, Pro, one credit, never
   auto-book). *Acceptance:* a core test that unbooked spans become draft entries and that
   nothing is written until the user accepts.
3. **§K K3 calendar↔timer trigger** — a deterministic coupling (linked meeting start → timer
   start; end → ask once, never auto-stop). *Acceptance:* a state-machine test that the timer
   starts on the linked project and the end prompt fires exactly once.
4. **§K K4 plan-vs-realized revenue** — expected (calculated) vs realized revenue + a ±% variance
   for fixed-fee projects. *Acceptance:* a pure test of the variance across over/under/on-plan.
5. **§K K5 shutdown ritual** — a deterministic aggregation (booked / reality / open drafts /
   tomorrow-first). *Acceptance:* a core test that open drafts and tomorrow's first block surface
   from real state.
6. **§F6 family-market** — `--life` person shades; the one-link partner-light invite; Google/Apple
   sync adapters (behind the same calendar port); KI5 photo/mail import (violet, Pro); the
   Work/Life/Both layer filter. *Acceptance:* per item — a token test, an isolation test that the
   partner-light view exposes only Free/Busy, a layer-filter test that "Work" hides life entries.
7. **Shield-icon** — a stroke-shield SVG replacing the 🛡 emoji in the D14 surfaces (drawer toggle,
   digest, Island prompt, role badge). *Acceptance:* a render test asserting the SVG icon, not the
   emoji.

## Consequences

- **Positive:** recurrence becomes one deterministic core every entry type and the Co-Planner
  share; the competitive-parity features are honest and rule-based (AI only phrases, never books);
  the family layer stays opt-in and minimal (no chat/lists/chores); the icon language stays
  consistent.
- **Negative / risks:** recurrence, the family layer and the calendar-trigger touch persistence
  and isolation — each is gated behind an acceptance test before it ships. Google/Apple sync
  widens the vendor surface; it stays behind the one calendar port (ADR ports-and-adapters rule).
- **Neutral:** `--life` gains person shades; the shield SVG is one more icon in the existing grid.

## Alternatives considered

- **A bespoke recurrence model** (custom "this vs series" semantics). Rejected: the Outlook
  convention (split the series at the edit) is what users know; `truncateBefore` implements it.
- **Clamping a monthly 31st to the 28th/last day.** Rejected: silently moving a series is a
  reliability bug (a missed entry = a child left waiting); short months are **skipped**.
- **Rendering the 🛡 emoji.** Rejected by the handoff: it renders in colour and breaks the
  monochrome icon language; a stroke-shield SVG is mandated.
- **Screenshots / GPS / force-timers for parity.** Rejected: anti-surveillance is a validated
  selling point and the honesty brand.
