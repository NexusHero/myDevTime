# ADR 0005: Deterministic Tracking Core; LLM as an Assist Layer, Never the Bookkeeper

## Status

Accepted

## Context

Tracked time is billing-relevant data: entries become timesheets, timesheets become invoices, and
a wrong duration or a silently re-categorized entry costs the user real money and client trust.
At the same time, the product's differentiator (ADR-0002) is a strong AI layer: auto-categorizing
calendar events and entries, natural-language time entry, generated summaries, and an assistant
over the user's own data. The sibling project Finanzo faced the same tension for tax data and
resolved it with a principle that transfers directly: **deterministic rules decide, the LLM
assists and explains.** LLM output is non-reproducible; billing data must be auditable.

## Decision

All state that reaches a timesheet, budget, or invoice is produced by **deterministic, pure,
exhaustively-tested logic**: time-entry math, budget/rate calculations, and a versioned **rules
engine** (user-defined matchers: calendar-event patterns, app/branch/issue-key patterns → project
/task/tag/billable). The **LLM layer sits on top as an assist**, in exactly four roles:

1. **Proposal** — suggesting a categorization for an entry the rules engine could not decide,
   always constrained to candidates the deterministic layer allows, always marked as a proposal
   until the user (or an explicit user-enabled auto-accept rule) confirms it.
2. **Parsing** — natural-language time entry ("2h on Finanzo review yesterday") parsed into a
   *draft* structured entry the user sees before it is saved.
3. **Explanation & summarization** — weekly/standup summaries, report narratives, budget-risk
   explanations. Generated text never mutates tracking state.
4. **Assistant** — a chat interface grounded exclusively in the user's own workspace data;
   deep-links into the app, never writes state from chat.

Every AI-touched entry records provenance (`source: timer | manual | calendar | rule:<id> |
ai-proposal`, plus accepted/corrected/rejected), so any number on an invoice is traceable to who
or what created it. LLM providers are accessed through one narrow interface with provider/model
as configuration (multi-provider capable), vendor types confined to a single adapter file; every
AI feature degrades gracefully to the deterministic path when the provider is down.

## Consequences

- The billing pipeline is fully testable and reproducible — the ≥90 % coverage gate applies to a
  pure core with no LLM in the loop.
- AI features are additive: unavailable LLM ⇒ rules still categorize, timers still run, invoices
  still add up. No feature on the money path *requires* a model call.
- Corrections to AI proposals are captured, not discarded — the exact feedback data a future
  learning loop (post-1.0 backlog) needs.
- Cost control is structural: model calls happen on explicit user actions and batched
  categorization runs, never per-keystroke; rate limits on AI endpoints are part of the security
  baseline.
- The user-visible framing follows Finanzo's "Vorschlag" discipline: AI output is always labeled
  as a suggestion, which also keeps store-review and trust expectations honest.
