# ADR 0021: Task Effort Estimation — Deterministic Baseline + User Estimate + AI Review

## Status

Accepted — extends the 1.0 scope union (ADR-0002/0008/0010/0011/0012/0013). **This ADR grows
1.0 without a displacement.** ADR-0013 warned that the next scope addition should "displace, not
add"; the owner has explicitly chosen to grow the scope here rather than move something out. The
bet on a large 1.0 gets one feature larger; the displace-not-add discipline still stands for the
*next* scope ADR.

## Context

Owner feature request (2026-07-08): a developer planning a task wants an **estimation surface** —
open a task, pick a few complexity/category attributes, get a **rough baseline estimate**, record
**their own estimate**, and be able to **ask the AI what it thinks of that estimate**. Once the
task is tracked, estimate-vs-actual should become visible so estimation skill improves over time.

myDevTime already has the two halves this needs: a deterministic core that owns every number that
reaches a user (ADR-0005), and an AI-assist layer that proposes/explains but never mutates state.
Estimation is a textbook fit for that split — the danger of a naive "AI, how long will this take?"
feature is exactly the false-precision, unaccountable-number trap the product exists to avoid.

## Decision

Add one requirement, **REQ-041 Task effort estimation** ([#90](https://github.com/NexusHero/myDevTime/issues/90)),
built along the deterministic/AI line:

- **Deterministic baseline (pure `packages/domain`).** Category/complexity attributes (task type,
  size, uncertainty) map through a transparent, versioned model to an hours **range**
  `{low ≤ expected ≤ high}` — never a single number, mirroring the burn-down forecast's
  anti-false-precision rule (REQ-038). Pure, exhaustively tested, no I/O.
- **User estimate is authoritative.** The task stores the user's own `estimateMinutes` plus the
  attribute inputs; provenance distinguishes *baseline-suggested* from *user-entered*. The baseline
  is a suggestion; it never overwrites the user's number.
- **AI estimate review is assist-only (ADR-0005).** The user may ask the AI to critique their
  estimate against the baseline and against actuals on similar past tasks. The AI returns
  commentary as a **proposal with provenance** — it never sets or mutates the estimate, and the
  feature degrades gracefully (baseline + history still shown) when the provider is down. No new
  vendor surface: it uses the existing LLM adapter (#17).
- **Plan-vs-actual** is computed by the deterministic core once time is tracked against the task,
  feeding reporting/burn-down (REQ-038) and the Co-Planner evening review (ADR-0011).

## Alternatives considered

- **AI-only estimate ("ask the model for a number"):** rejected — it violates ADR-0005 (an
  unaccountable number reaching the user), can't degrade when the provider is down, and gives false
  precision. The AI reviews; the deterministic model and the user own the numbers.
- **Free-text estimate only (no baseline):** simplest, but throws away the category signal the
  owner explicitly wants ("Kategorien aussuchen → ungefähre Abschätzung") and gives the AI review
  nothing objective to compare against.
- **Story points / abstract units:** rejected for a time-tracking product — estimates must be in
  the same unit as actuals (minutes) so plan-vs-actual is a direct, honest comparison.

## Consequences

- M1/M2 gain the deterministic model + task fields + the estimation form; the AI-review path rides
  on M3's LLM layer (#17), so the feature ships usefully (baseline + own estimate + plan-vs-actual)
  before the AI review lands.
- Estimation data is a task field: it flows into exports and erasure (DSGVO, REQ-020) like any
  other, and into search/assistant grounding.
- The estimation model is versioned like the rules engine — a model change is a new version with
  recorded provenance, so historical estimates stay explainable.
- 1.0 is now one feature larger by explicit owner choice; the next scope ADR must name what moves
  out.
