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
| [0004](0004-react-native-expo-client.md) | React Native + Expo client for all three platforms | Accepted (provisional) — confirmed by spike [#1](https://github.com/NexusHero/myDevTime/issues/1) ([findings](../spikes/0001-client-rn-expo.md)); residual on-device checklist (C1–C7) before the qualifier drops |
| [0005](0005-deterministic-core-llm-assist.md) | Deterministic tracking/billing core; LLM strictly an assist layer with recorded provenance | Accepted |
| [0006](0006-subscription-billing-stripe-plus-store-iap.md) | Subscriptions via Stripe on web + native IAP in stores, unified by an internal entitlement service | Accepted, amended by 0008 (explicit AI credits) |
| [0007](0007-authentication-email-oauth-sessions.md) | Email/password + Google & Apple sign-in, rotating token sessions, self-hosted auth module | Accepted — session mechanism amended by 0017 (opaque DB sessions); provider list extended by 0018 (+GitHub) |
| [0008](0008-tactiq-realignment-transcription-and-credits.md) | Scope update: Tactiq (not Tackle) as second reference; meeting transcription in 1.0; explicit AI-credit billing | Accepted — amends 0002 & 0006 |
| [0009](0009-meeting-capture-asr-approach.md) | Meeting-capture channel & ASR provider — decision frame fixed, winner pending the capture spike ([#31](https://github.com/NexusHero/myDevTime/issues/31)) | Proposed — pending the capture spike |
| [0010](0010-attendance-absences-signable-report.md) | Scope update: attendance (punch clock, breaks, overtime), absences (vacation/sick/holidays), signable PDF+XLSX work-time report — all 1.0 | Accepted — extends 0002/0008 |
| [0011](0011-ai-co-planner-and-design-language.md) | AI Co-Planner in 1.0 (plan entity, deterministic planner, ghost-block proposals) + binding UX vision with a prototype gate before component code | Accepted — extends scope; adds gate #39 → #11 |
| [0012](0012-competitive-feature-adoption.md) | Competitive adoption: focus mode + streaks, idle/forgotten-tracking detection, calendar write-back, Jira/Linear/Slack insight export — all 1.0 | Accepted — extends 0002/0008/0010/0011 |
| [0013](0013-competitive-adoption-round-2.md) | Competitive adoption round 2: entry notes, month overview with gap markers, budget burn-down forecast, Siri/App-Intents + Quick Tile, classic day list, Zeitausgleich absence type | Accepted — extends scope; next scope ADR must displace, not add |
| [0014](0014-monorepo-toolchain.md) | Monorepo toolchain: pnpm workspaces, Vitest (+ v8 coverage gate), ESLint flat type-checked + Prettier, one `test.sh` gate = CI, git hooks | Accepted |
| [0015](0015-backend-framework-and-persistence.md) | Backend framework & persistence: Fastify modular monolith (plugin-per-module) + PostgreSQL + Drizzle; RFC 7807 errors; generated OpenAPI | Accepted (realizes 0003) |
| [0016](0016-cicd-pipeline.md) | CI/CD pipeline (mirrors the Résumé project): commitlint, security (audit + dependency-review), CodeQL, Dependabot, tag-driven release, GitHub Pages OpenAPI mirror | Accepted |
| [0017](0017-auth-implementation-library.md) | Auth implementation: **Better-Auth** (self-hosted, MIT); focused libraries (openid-client + argon2 + @fastify/\*) kept as documented fallback; integration validated as acceptance criteria in #4 | Accepted — realizes & amends ADR-0007 |
| [0018](0018-social-providers-and-auth-edge.md) | Social providers **Google + Apple + GitHub** (Facebook rejected); Better-Auth hidden internally but exposed at the client edge on purpose | Accepted — extends ADR-0007 |
| [0019](0019-sync-protocol.md) | Cross-device sync: server-authoritative delta sync with per-entity optimistic versioning; deterministic per-entity-type conflict policy in `packages/domain` (LWW for catalog metadata, user-surfaced conflicts for time-entry intervals & delete-vs-edit) | Accepted — realizes the `sync` module (0003); engine is #9 Phase 2 |
| [0020](0020-export-rendering-stack.md) | Timesheet export/rendering: hand-rolled CSV, ExcelJS (XLSX), PDFKit (PDF) behind per-format serializer adapters over the deterministic `buildTimesheet`; server-side, `Intl` de/en formats | Accepted — realizes REQ-009's rendering layer (#14) |
| [0021](0021-task-effort-estimation.md) | Task effort estimation: deterministic category→hours-range baseline + user's own estimate + assist-only AI estimate review (never mutates the number) + estimate-vs-actual | Accepted — grows 1.0 (REQ-041, #90); no displacement, by explicit owner choice |
| [0022](0022-three-accent-themable-design-system.md) | Themable design system: two-axis tokens (accent × mode), three swappable accents (Sovereign / Ember / Blueprint) on shared neutrals; a11y contract across all six combinations | Accepted — extends ADR-0011; realizes #11's token/component foundation; **default accent superseded by 0023** |
| [0023](0023-blueprint-default-accent.md) | Default accent → **Blueprint** ("Königsblau" `#2563EB`); Sovereign/Ember stay first-class, user-selectable; token architecture & a11y contract unchanged | Accepted — supersedes the default-accent choice of ADR-0022 |

## Tech Radar

One line per technology so the stack's shape stays visible without re-reading the ADR log
(process skill §1.4). Adopt / Trial / Assess / Hold.

| Technology | Ring | Decided by |
|------------|------|------------|
| Node.js + TypeScript (`strict`) backend | Adopt | ADR-0003 |
| pnpm workspaces (monorepo) | Adopt | ADR-0014 |
| Vitest (+ v8 coverage gate) | Adopt | ADR-0014 |
| ESLint flat (type-checked) + Prettier | Adopt | ADR-0014 |
| Fastify (backend HTTP framework) | Adopt | ADR-0015 |
| PostgreSQL | Adopt | ADR-0015 |
| Drizzle ORM (+ drizzle-kit migrations) | Adopt | ADR-0015 |
| React Native + Expo (+ react-native-web, EAS) | Adopt (provisional — spike #1 passed; on-device checklist pending) | ADR-0004 |
| react-native-reanimated + Gesture Handler (Day Canvas 60fps) | Adopt | ADR-0004/0011 |
| expo-sqlite (offline-first local store) | Adopt | ADR-0004/0019 |
| Themable design tokens (`@mydevtime/design`: accent × mode, 3 accents; Blueprint/Königsblau default) | Adopt | ADR-0011/0022/0023 |
| react-native-svg (instrument viz: budget rings, balance gauge, sparklines) | Adopt | ADR-0011/0022 (ux-vision §2.5) |
| Inter · Space Grotesk · JetBrains Mono via expo-font / @expo-google-fonts (Blueprint trio) | Adopt | ADR-0022 (font-loading slice) |
| Flutter | Hold (named fallback; not triggered by the spike) | ADR-0004 |
| Stripe (Checkout + Billing) | Adopt | ADR-0006 |
| StoreKit 2 / Play Billing | Adopt | ADR-0006 |
| RevenueCat | Assess (re-evaluate when IAP work starts) | ADR-0006 |
| LLM providers (multi-provider via config) | Adopt (behind one adapter interface) | ADR-0005 |
| ASR providers (Whisper/Deepgram/AssemblyAI/…) | Assess (spike #31, behind `TranscriptionPort`) | ADR-0009 |
| Meeting-bot capture service (Recall.ai-style) | Assess (first candidate in the capture spike) | ADR-0009 |
| Auth SaaS (Auth0/Clerk/…) | Hold | ADR-0007 |
| argon2 password hashing, OIDC client libs | Adopt | ADR-0007 |
| Better-Auth (self-hosted TS auth framework) | Adopt (integration validated in #4) | ADR-0017 |
| Social login: Google + Apple + GitHub | Adopt | ADR-0007/0018 |
| Facebook login | Hold (rejected — weak fit for the dev audience) | ADR-0018 |
| openid-client + @node-rs/argon2 + @fastify/\* (focused-libs fallback) | Assess (documented escape hatch if #4 can't meet the criteria) | ADR-0017 |
| Lucia (auth library) | Hold (retired upstream — not a dependency) | ADR-0017 |
| Server-authoritative delta sync (per-entity versioning + tombstones) | Adopt | ADR-0019 |
| Deterministic per-entity conflict policy (in `packages/domain`) | Adopt | ADR-0019 |
| CRDT libraries (Yjs / Automerge) | Assess/Hold (revisit only for real multi-user collaboration) | ADR-0019 |
| ExcelJS (XLSX export, behind an adapter) | Adopt | ADR-0020 |
| PDFKit (PDF export, behind an adapter) | Adopt | ADR-0020 |
| Headless Chromium → PDF (Puppeteer) | Hold (heavy + non-deterministic bytes; revisit if layout outgrows PDFKit) | ADR-0020 |
| GitHub Actions CI (gate + Postgres integration + commitlint) | Adopt | ADR-0014/0016 |
| CodeQL (javascript-typescript, security-and-quality) | Adopt | ADR-0016 |
| Dependabot (npm + github-actions, grouped) | Adopt | ADR-0016 |
| GitHub Pages OpenAPI mirror (self-hosted Swagger UI) | Adopt | ADR-0016 |
