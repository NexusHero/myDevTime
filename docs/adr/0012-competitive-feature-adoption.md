# ADR 0012: Competitive Feature Adoption — Focus Mode, Idle Detection, Calendar Write-Back, Dev-Tool Export in 1.0

## Status

Accepted — extends the 1.0 scope union (ADR-0002/0008/0010/0011). (The pricing ADR from #29
moves to the next free number, currently 0013.)

## Context

A competitive review against the three adjacent categories (2026-07-07, owner decision) found
four capabilities where established products create daily habit or trust that myDevTime's union
would otherwise lack:

- **Pomodoro/focus apps** (Focus To-Do, Session, Forest): frictionless focus sessions,
  statistics and **streaks** are their retention engine — and their weakness is that focused
  time lands in a silo instead of the billable record.
- **Tyme**: idle/forgotten-tracking detection is a major trust feature — the app notices what
  you forgot instead of silently recording nonsense.
- **Session**: writing sessions back into the calendar turns the calendar into the actual-time
  protocol.
- **Tactiq**: exporting meeting insights into the tools where work happens (for our audience:
  Jira, Linear, Slack) is its most-loved workflow.

All four fit the existing architecture without new subsystems: focus cycles and idle heuristics
are pure domain logic; write-back extends the existing `CalendarProviderPort`; export is a new
narrow port consuming #33's insights.

## Decision

1.0 gains four requirements, all deterministic-core features under existing disciplines:

- **REQ-032 Focus mode + streaks** (#41): Pomodoro cycles surfaced in the Island, sessions are
  ordinary time entries; calm focus statistics and a streak in reports; optional native DND.
- **REQ-033 Idle & forgotten-tracking detection** (#42): explainable, dismissible hints with
  trim/punch-out proposals — user confirms, nothing auto-corrects, no surveillance-grade
  activity logging (ADR-0002 non-goal upheld).
- **REQ-034 Calendar write-back** (#43): opt-in mirror of tracked blocks into a dedicated
  calendar with privacy presets and incremental write-scope consent.
- **REQ-035 Dev-tool export** (#44): confirmed, previewed export of meeting insights/action
  items to Jira, Linear, Slack via one `ExportTargetPort`.

## Consequences

- M2 grows by #41/#42, M3 by #43/#44 — the owner accepts the schedule pressure in exchange for
  category-complete 1.0 positioning ("die Union plus die Bindungs- und Vertrauensfeatures der
  Kategorie-Bestem").
- #44 adds three external adapters and OAuth surfaces — the largest true cost in this batch; if
  1.0 slips, ADR-0011's degradation pattern applies here first (targets can ship one-by-one,
  Slack first).
- Streaks introduce a retention mechanic: kept deliberately calm (no trees, no confetti — ux-vision
  §5); absences must not break streaks or the mechanic punishes vacation.
- Idle detection touches privacy perception: evidence-based hints only, thresholds configurable,
  and the "no app/window logging" line from ADR-0002 stays hard.
- The UI prototype gains all four surfaces (Island focus state, streak tile, correction hint,
  integration toggles/export buttons) so the #39 user test covers them.
