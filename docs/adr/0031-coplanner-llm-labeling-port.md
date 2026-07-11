# ADR 0031. Co-Planner LLM labeling via a `PlanLabeler` port, credit-priced at the composition layer

## Status

Accepted — realizes the deferred "LLM garnish" clause of ADR-0011 for the Co-Planner
(REQ-031, issue #151), on top of the deterministic `buildDayPlan` core (ADR-0005) and the
`LlmPort` (ADR-0029) and credit ledger (ADR-0008).

## Context

ADR-0011 scopes the AI Co-Planner so that the **deterministic** algorithm places every block
and the LLM may only *rank and label within the code-enforced blocks* — never place time. That
garnish was deferred until the day plan and canvas shipped (delivered in #40). Wiring it now
raises a coupling question: the `planner` module would need both the LLM (`ai` module) and the
credit ledger (`billing` module), and doing that naively coupled three modules and let the LLM
path fail a request or bill for a briefing the AI never produced.

Constraints:

- The LLM must **never place time** and its output must be **validated, never trusted** (ADR-0005).
- The feature must **degrade gracefully** — a down/unfunded/ malformed provider still returns
  useful labels (the deterministic ones).
- One briefing costs **one credit**, and re-labeling the same plan must not double-charge (ADR-0008).
- `packages/domain` stays pure; vendor/LLM types stay confined (skill §2.2, ADR-0029).

## Decision

1. **A narrow `PlanLabeler` port owned by the planner.** The controller/service depend on
   `PlanLabeler` (`label(plan, { allowAi }) → { source, labels }`), never on `LlmPort` or the
   billing service directly (DIP). Two implementations: `DeterministicPlanLabeler` (the pure
   fallback) and `LlmPlanLabeler` (wraps `LlmPort`). The LLM-backed labeler is bound by a factory
   provider over the existing `LLM` token; only that factory touches the `ai` module.

2. **The shape is shared with the deterministic fallback.** `PlanLabel` (`blockIndex`, `note`,
   `rank`) is produced by the pure `deterministicLabels` core in `packages/domain` and is exactly
   what the LLM is asked to fill. So "graceful degradation" is just returning the deterministic
   labels — same shape, no branching for callers. The LLM path never throws: an unavailable
   provider, a thrown call, or an unparseable/wrong-length completion all fall back.

3. **Credit pricing lives one layer up, in the controller (composition layer).** The controller
   checks the balance to decide `allowAi`, calls the port, and debits **one credit only when the
   result is `ai-proposal`** (the AI actually ran) — idempotent on `plan-label:<planId>` so a
   replay never double-charges. The port stays free of billing concerns.

`POST /api/planner/plans/:id/label` returns `{ source, charged, labels }`.

## Consequences

- **Clean seams.** The planner depends on one interface it owns; the LLM and billing are wired at
  the edges. Swapping the labeler (or the provider behind `LlmPort`) is a one-file change; SOLID
  holds (DIP/SRP/OCP).
- **Honest billing.** No credit is spent unless the AI produced the labels, and re-labeling is
  free/idempotent.
- **Safe by construction.** With the `NullLlm` default (no provider configured), every response is
  deterministic and free — the AI is purely additive.
- **Cost.** The planner module now provides the `LLM` binding and a labeler factory, and the
  controller imports the billing debit at the composition layer — a deliberate, narrow coupling
  documented here rather than a direct module-to-module dependency.
- **Not covered.** The evening-review (plan-vs-actual) *client* surface over the existing
  `reviewDayPlan` core is a separate client slice; only the labeling garnish is delivered here.
