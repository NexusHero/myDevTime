# Architecture Decision Records

Significant, hard-to-reverse decisions, captured so the _why_ survives the people who made it.
Format is a lightweight [MADR](https://adr.github.io/madr/): **Context → Decision → Consequences**
(+ **Alternatives considered** when the choice was close), plus a status. Numbering is sequential
and immutable; a decision that replaces another **supersedes** it rather than editing history.

This is a hard rule, not a suggestion: a PR that introduces or swaps a technology, or changes a
cross-cutting architectural pattern, does not merge without a new or updated ADR in the same
PR — see [`CONTRIBUTING.md`](../../CONTRIBUTING.md#ways-of-working) and
[`skills/ultimate-dev-process/SKILL.md`](../../skills/ultimate-dev-process/SKILL.md) §1.2.

## Writing one

Copy the newest file as a starting point, take the next free number, and keep the MADR shape: a
short **Context** (the forces at play), the **Decision** in one or two sentences, and
**Consequences** (what this enables, what it costs, what it forecloses). Add the row to the table
below in number order.

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-adopt-ultimate-development-process.md) | Adopt the Ultimate Development Process (via sibling project Finanzo) as this project's governance model | Accepted |
| [0002](0002-product-scope-unify-tyme-and-tackle.md) | Product scope: unify Tyme's mobile/tablet UX with the second reference's AI automation & billing, plus an own AI layer — iOS + Android + Web from 1.0 | Accepted, amended by 0008 (reference = Tactiq; transcription in 1.0) |
| [0003](0003-node-typescript-backend.md) | Node.js/TypeScript backend as a modular monolith | Accepted |
| [0004](0004-react-native-expo-client.md) | React Native + Expo client for all three platforms | Proposed — pending the cross-platform spike |
| [0005](0005-deterministic-core-llm-assist.md) | Deterministic tracking/billing core; LLM strictly an assist layer with recorded provenance | Accepted |
| [0006](0006-subscription-billing-stripe-plus-store-iap.md) | Subscriptions via Stripe on web + native IAP in stores, unified by an internal entitlement service | Accepted, amended by 0008 (explicit AI credits) |
| [0007](0007-authentication-email-oauth-sessions.md) | Email/password + Google & Apple sign-in, rotating token sessions, self-hosted auth module | Accepted |
| [0008](0008-tactiq-realignment-transcription-and-credits.md) | Scope update: Tactiq (not Tackle) as second reference; meeting transcription in 1.0; explicit AI-credit billing | Accepted — amends 0002 & 0006 |
| [0009](0009-meeting-capture-asr-approach.md) | Meeting-capture channel & ASR provider — decision frame fixed, winner pending the capture spike ([#31](https://github.com/NexusHero/myDevTime/issues/31)) | Proposed — pending the capture spike |
| [0010](0010-attendance-absences-signable-report.md) | Scope update: attendance (punch clock, breaks, overtime), absences (vacation/sick/holidays), signable PDF+XLSX work-time report — all 1.0 | Accepted — extends 0002/0008 |
| [0011](0011-ai-co-planner-and-design-language.md) | AI Co-Planner in 1.0 (plan entity, deterministic planner, ghost-block proposals) + binding UX vision with a prototype gate before component code | Accepted — extends scope; adds gate #39 → #11 |

## Tech Radar

One line per technology so the stack's shape stays visible without re-reading the ADR log
(process skill §1.4). Adopt / Trial / Assess / Hold.

| Technology | Ring | Decided by |
|------------|------|------------|
| Node.js + TypeScript (`strict`) backend | Adopt | ADR-0003 |
| React Native + Expo (+ react-native-web, EAS) | Trial → Adopt after spike | ADR-0004 |
| Flutter | Hold (named fallback if the spike fails) | ADR-0004 |
| Stripe (Checkout + Billing) | Adopt | ADR-0006 |
| StoreKit 2 / Play Billing | Adopt | ADR-0006 |
| RevenueCat | Assess (re-evaluate when IAP work starts) | ADR-0006 |
| LLM providers (multi-provider via config) | Adopt (behind one adapter interface) | ADR-0005 |
| ASR providers (Whisper/Deepgram/AssemblyAI/…) | Assess (spike #31, behind `TranscriptionPort`) | ADR-0009 |
| Meeting-bot capture service (Recall.ai-style) | Assess (first candidate in the capture spike) | ADR-0009 |
| Auth SaaS (Auth0/Clerk/…) | Hold | ADR-0007 |
| argon2 password hashing, OIDC client libs | Adopt | ADR-0007 |
