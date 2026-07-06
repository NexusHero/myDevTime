# ADR 0010: Scope Update — Attendance Tracking, Absences, and the Signable Work-Time Report in 1.0

## Status

Accepted — extends the 1.0 scope union of
[ADR-0002](0002-product-scope-unify-tyme-and-tackle.md) /
[ADR-0008](0008-tactiq-realignment-transcription-and-credits.md). Nothing is removed or
reversed. (Note: the pricing ADR reserved as "ADR-0010" in #29's ⚠️ comment takes the next free
number instead.)

## Context

Owner decision (2026-07-06): myDevTime must cover not only *project* time but the **work day
itself** — einstempeln/ausstempeln, breaks, sick days, vacation — with project time recorded
*inside* that frame ("heute 08:30–17:15 gearbeitet, 30 min Pause, davon 5h auf Projekt X"), rich
statistics over both, and a **signable** monthly work-time record (PDF *and* Excel) a supervisor
or client can countersign.

Neither reference product covers this: **Tyme** tracks project time (timers, budgets, stats,
exports) but has no punch clock, no break rules, no vacation/sick accounting, no
signature-ready Arbeitszeitnachweis. **Tactiq** does no time tracking at all. Attendance tools
(Clockify-style punch clocks, absence.io-style leave trackers) exist but are separate products —
the union in one developer/freelancer tool is exactly the "ultimate AI-gestütztes Management
Tool von Zeit und Meetings" thesis.

The domain fits the existing architecture cleanly: work-day math (punch pairs, breaks, target
hours, overtime, allowances) is deterministic pure logic like everything else on the money path
(ADR-0005), and the signable report is a sibling of the timesheet export (REQ-009).

## Decision

1.0 gains three requirements, all deterministic-core features (no LLM on any computed value):

- **REQ-028 Attendance** (#36): work-day model with clock-in/out, breaks, effective-dated
  target-hour schedules, overtime balance, project-coverage reconciliation, and a configurable
  **break-rule check** (German ArbZG §4 preset) surfacing violations as warnings.
- **REQ-029 Absences** (#37): vacation/sick/holiday/custom types, half-days, region-based
  public-holiday calendars, allowance and carry-over math, correct interplay with target hours.
- **REQ-030 Signable report** (#38): monthly Arbeitszeitnachweis as **PDF with signature
  blocks** and **structured XLSX**, rendered from domain-computed values only, flagged
  break-rule violations included.

Statistics (#13) and the mobile today-view (#12) extend to attendance (⚠️-comments on those
issues); the project-timesheet export (#14) gains XLSX alongside CSV/PDF for consistency.

## Consequences

- Attendance and project tracking stay **independent**: either works without the other, so
  freelancers who only bill projects and devs who only stamp hours are both first-class.
- M1/M2 grow by three issues; the critical path is unchanged (nothing new blocks the client
  spike, AI, or billing chains), but total 1.0 volume rises — the schedule pressure is accepted
  by the owner in preference to shipping a partial time story.
- The break-rule/ArbZG check is a **hint engine, not legal compliance certification** — the
  report prints the rule preset used; marketing must not overclaim ("unterstützt
  Arbeitszeit-Dokumentation", nicht "ArbZG-zertifiziert").
- A digital signature flow (drawn/cryptographic signatures, approval workflow) is explicitly
  **out of 1.0** — the report is designed for print-or-PDF countersigning; workflow signatures
  join the Teams backlog.
- The AI layer gets a richer grounding surface for free: overtime and absence facts flow into
  summaries (#19) and the assistant (#20) as deterministic tool results, no new AI machinery.
