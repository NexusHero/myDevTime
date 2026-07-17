# ADR 0065: Design v13 — smart quick-add, economics truths, travel, monthly statement, grounded AI

## Status

Accepted (owner decision) — **extends ADR-0063** (calendar-centric IA) and ADR-0064
(auto-tracker reality layer). Bound by ADR-0005 (deterministic core; AI proposes, the user
books), ADR-0029 (the one grounded LLM port), and ADR-0010 (work-time). Realizes the v13
design handoff (K6 smart Plus, G1–G4 economics/travel, KI1–KI4, X monthly statement).

## Context

The v13 handoff refines the calendar-centric IA (ADR-0063) with a headline **smart Plus**
button and a wave of "difference-maker" features, and optimises several older surfaces
away. Each new capability had to be added **without mock data**, in English, with any
feature lacking a requirement getting one plus an acceptance test, and with the AI features
wired to the **real** grounded LLM port (not a stub). The house rules stand: every number
that reaches a timesheet/budget/export/invoice is computed by pure, exhaustively-tested
logic in `packages/domain`; the LLM only proposes/parses/phrases, marked as a proposal with
provenance, debiting credits, degrading gracefully; workspace isolation; consent-first
capture; no server upload of activity data (ADR-0058/0059).

The new capabilities, and why each needs a decision:

- **K6 Smart-Add** — "one plus, one field". A single phrase must classify into a *typed*
  entry (task/meeting/absence/travel/private). The risk is type-detection logic scattering
  across the mobile field, ⌘K and the Today field, and the AI silently guessing types.
- **G1 Price of the week** — after Fill-week, show what a week *costs* across intensities.
- **G2 Effective-rate truth** — the honest hourly worth once unbilled time counts.
- **G3 Overtime compound** — where the overtime balance is heading if the pattern holds.
- **G4 Travel** — a first-class entry type with its own pricing (time is not billed in
  full; a train is worktime; distance earns a mileage allowance) and privacy constraints.
- **KI1–KI4** — a Drift-Coach, a history-grounded quote, an invoice translator, meeting
  follow-ups: features whose value is *phrasing*, but whose numbers must stay deterministic.
- **X Monthly statement** — a signable "real punch clock" PDF the current REQ-030 report
  doesn't cover (no begin/pause/end columns, no cumulative balance, no carryover).

## Decision

1. **One Smart-Add brain (K6, REQ-047).** Type detection lives in exactly one pure function,
   `packages/domain/src/smartadd/parse.ts#parseEntry`, shared by every entry surface. It
   returns a typed draft with a `needsAi` flag. A vague phrase falls to **Stage 2**
   (`apps/api` `SmartAddService`), which asks the grounded LLM only to *rewrite* the phrase
   into a canonical quick-add sentence that is **re-parsed by the same core** — the AI never
   emits a draft directly, so a written entry can never bypass the rules (ADR-0005). Stage-2
   debits one credit and the result wears the violet AI signature; Stage-1 never does.

2. **Deterministic economics core (G1–G3, REQ-048/049/050).** New pure module
   `packages/domain/src/economics`: `effective-rate` (nominal ÷ billable vs effective ÷
   all-tracked, exact BigInt division), `overtime-forecast` (running balance + OLS forecast +
   pattern note), `week-price` (intensity solver trading peak-day strain for free days). No
   AI touches any of these numbers. Reports renders G2/G3 from the user's real summaries.

3. **Travel as a priced entry type (G4, REQ-051).** New pure module
   `packages/domain/src/travel`: `priceTravel` (reduced-fraction time + per-km allowance,
   **train = full worktime**), plus proposal helpers (`returnTrip`, `nextLegStart`,
   `frequentRoutes`) that are pure suggestions the user confirms. Location is used only at
   start/stop, never streamed (ADR-0058/0059). Smart-Add classifies travel phrases.

4. **Grounded AI difference-makers (KI1–KI4, REQ-053/054).** The quote's number comes from a
   deterministic `estimating/quote` estimator (distribution + buffered suggestion, null with
   no history). The four features share one `LlmInsights` primitive in `apps/api` that phrases
   the *caller's own facts* over the ADR-0029 port, refuses cleanly off-data, degrades to a
   deterministic fallback, and debits one credit per real proposal. The client marks
   `ai-proposal` vs `deterministic` so violet provenance appears only on real model output.

5. **Monthly statement (X, REQ-052).** New pure `attendance/statement.ts#buildMonthlyStatement`
   folds real punch events into begin/pause/end + ± per day and a cumulative balance threaded
   from a **year-to-date carryover** (prior months of the year, absences credited) to a
   closing figure. A single PDFKit adapter (`monthlyStatementToPdf`) renders it; the number
   never leaves the core. Exposed at `GET /api/worktime/statement`.

## Consequences

- **Positive.** Type detection is testable in one place; every money/time figure stays in
  the deterministic core with ≥90 % coverage; the AI is confined to phrasing over the one
  port and is always a labelled, credit-metered, gracefully-degrading proposal; the monthly
  statement is reproducible (pinned PDF metadata) and auditable.
- **Negative / follow-ups.** This ADR lands the deterministic cores, the AI services and the
  first client surfaces (Smart-Add sheet, Reports G2/G3, WorkTime statement export). The
  richer surfaces — the Planner Price-of-week panel (G1), the travel route-card drawer (G4),
  and the on-screen KI cards — read these same cores and are the tracked follow-ups; the
  register marks REQ-047…054 **Partial** until their acceptance-tier tests land.
- **Neutral.** No new vendor dependency; the LLM stays behind the ADR-0029 port; travel and
  activity data remain on-device per ADR-0058/0059.
