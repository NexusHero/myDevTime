# ADR 0008: Scope Update — Tactiq (not Tackle) as Second Reference; Meeting Transcription in 1.0; Explicit AI-Credit Billing

## Status

Accepted — amends [ADR-0002](0002-product-scope-unify-tyme-and-tackle.md) (reference product,
1.0 scope) and [ADR-0006](0006-subscription-billing-stripe-plus-store-iap.md) (AI monetization
model). Those ADRs stay in force for everything not named here.

## Context

ADR-0002 named **Tackle** (timetackle.com) as the second reference product. That was a research
misidentification: the owner's actual reference is **Tactiq** (tactiq.io) — an AI meeting tool
(Chrome extension for Google Meet, Zoom, MS Teams) built on live transcription (30+ languages),
AI summaries/action items, **reusable AI prompts/workflows**, and a monetization model of tiered
plans with **AI credits** (1 credit = 1 AI action; Free 5/month, Pro 10/month, Team+ unlimited,
plus per-seat pricing). The owner confirmed three scope consequences on 2026-07-06:

1. Tactiq replaces Tackle as the second reference alongside Tyme.
2. **Meeting transcription is 1.0 scope**, not backlog — meetings become tracked time *with
   their content attached*.
3. AI monetization uses **explicit, visible AI credits** à la Tactiq, not invisible plan caps.

Calendar auto-capture (REQ-010, issue #15) — originally justified by the Tackle comparison —
stays in scope by explicit owner decision: it is the strongest automation source for a time
tracker and the natural anchor for meeting transcripts.

## Decision

- **Reference framing (amends ADR-0002):** myDevTime unifies **Tyme's** mobile/tablet tracking
  UX with **Tactiq's** AI capability & monetization model. The 1.0 scope union gains:
  **meeting transcription** (capture per [ADR-0009](0009-meeting-capture-asr-approach.md), spike
  #31; pipeline REQ-025/#32) and **AI meeting insights** — summaries, action items, and
  Tactiq-style reusable custom prompts over transcripts (REQ-026/#33). Billing-grade
  timesheet/invoice output (REQ-009) remains in scope — it came from the product thesis, not
  from the misidentified reference.
- **Monetization (amends ADR-0006):** AI usage is accounted in an **explicit credit ledger**
  (REQ-027/#34): visible balance, 1 credit = 1 AI action with a data-driven per-action cost
  table, monthly plan allowances, and **top-up packs** sold as Stripe one-time payments (web)
  and consumable IAP (stores) through the existing `PaymentProviderPort`. The entitlement
  service remains the single source of truth; deterministic features never cost credits.

## Consequences

- Transcription adds the product's first non-HTTP integration surface (audio/captions capture)
  and its highest-risk subsystem — de-risked by spike #31 before the pipeline is built, exactly
  like the client-stack spike (#1) pattern.
- Recording consent becomes a first-class legal/UX concern (DSGVO, two-party-consent rules):
  consent-first capture is an acceptance criterion of #32 and a named risk in the architecture
  documentation.
- ASR cost per meeting-minute becomes a unit-economics input: pricing (#29) and the credit cost
  table (#34) cannot be finalized before the spike's cost findings.
- Credits are more UI and billing machinery than plain caps (ledger, top-up products on three
  rails, balance UX) — the price of Tactiq-grade cost transparency. Issues #17–#20/#33 debit
  the ledger instead of checking a cap; #21 gains the ledger as its core data structure.
- ADR-0002 and ADR-0006 are **not** superseded — their decisions stand except where amended
  here; their files gain an "Amended by ADR-0008" status note, history unrewritten.
