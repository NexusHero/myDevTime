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
| [0024](0024-backend-dependency-wiring.md) | Backend dependency wiring: manual constructor injection (factory modules over typed `deps`) + Fastify plugin/decorator composition; DIP via narrow ports, not a container | Accepted — **superseded by 0025** (owner chose NestJS DI) |
| [0025](0025-adopt-nestjs-on-fastify.md) | Adopt **NestJS 11 on `@nestjs/platform-fastify`**: modules/controllers/providers + container DI, `nestjs-zod` validation/OpenAPI, RFC-7807 exception filter, Better-Auth guard; Fastify kept as HTTP layer; `packages/domain` stays pure | Accepted (owner decision) — supersedes 0024 & the composition/DI half of 0003/0015; resolves spike [#104](https://github.com/NexusHero/myDevTime/issues/104) |
| [0026](0026-design-system-pro-tier-adjustments.md) | Design system pro-tier adjustments: density tokens (regular/compact) on `Theme`, 12-color categorical project palette, absolute (non-`rgba`) soft semantic colors for deterministic WCAG contrast across surfaces, a micro logo variant | Accepted — extends ADR-0011/0022/0023 |
| [0027](0027-mobile-ui-testing-strategy.md) | Mobile UI testing strategy: `@testing-library/react-native` + `react-test-renderer` component tests for `apps/mobile`, run by the same Vitest runner (ADR-0014) via a JSDOM environment and native-module mocks at the app boundary | Accepted — extends ADR-0014 |
| [0028](0028-rest-over-graphql-api-style.md) | Client↔server API style: RESTful resource endpoints (not GraphQL/tRPC); composed reads get purpose-built aggregate endpoints; a read-only GraphQL/BFF facade stays available additively if ever needed | Accepted — makes explicit the API-style dimension of ADR-0003/0015/0025 |
| [0029](0029-llm-provider-port.md) | Provider-agnostic **`LlmPort`**: one narrow interface (`complete`/`available`, structured output + token usage), vendor SDK types confined to per-provider adapters (`openai`/`anthropic`/`gemini`/`ollama`); provider chosen by config; a `NullLlm` default so AI degrades gracefully — LLM proposes only (ADR-0005) | Accepted (owner decision) — the port that unblocks the AI layer (REQ-013/014/015/026); real adapters land with the features |
| [0030](0030-comprehensive-design-system.md) | Comprehensive, production-grade design system: expanded token scale (spacing s0–s8, typography 2xs–3xl, motion timing + easing, borders, app-shell geometry), integrated branding assets (logos, splash, favicon), font loading (Blueprint: Inter/JetBrains/Space Grotesk, Sovereign/Ember: system), deterministic project colors via FNV-1a hash, all components token-driven, WCAG AA verified across six theme combinations | Accepted — realizes & extends ADR-0011/0022/0023/0026; closes design-system spike, unblocks full-fidelity UI implementation across all platforms |
| [0031](0031-coplanner-llm-labeling-port.md) | Co-Planner **LLM garnish** behind a narrow `PlanLabeler` port owned by the planner: the LLM only ranks/labels the code-enforced blocks (never places time), sharing the `PlanLabel` shape with the pure deterministic fallback so it degrades gracefully; one credit debited only when the AI actually ran, idempotent per plan, priced at the controller/composition layer | Accepted — realizes the deferred ADR-0011 garnish clause (REQ-031/#151) over `LlmPort` (0029) + credit ledger (0008) |
| [0032](0032-connector-token-vault.md) | **Connector token vault**: per-user/workspace OAuth access+refresh tokens for dev/chat/calendar integrations stored **encrypted at rest** (envelope encryption + AEAD, KMS-sealed in prod), behind a narrow `TokenVault` port; refresh + rotate + revoke; workspace-isolated; keys never in source, tokens never logged; crypto backend confined to one adapter | Accepted (owner decision) — secret-storage foundation for the connectors layer; KMS backend a Trial detail |
| [0033](0033-connector-scopes-and-consent.md) | **Connector scopes & consent**: least-privilege scopes per capability (read-only by default, write only on opt-in), consent stored **per connector and per capability** (inbound/outbound/capture), preview-before-write, revocation+erasure into the DSGVO flows, per-provider data-processing matrix, audit trail — generalises consent-first (REQ-025) to all integrations | Accepted (owner decision) — permission foundation for the connectors layer; per-provider scope sets filled as adapters land |
| [0034](0034-signal-palette-refresh.md) | **Signal-palette refresh** (post-user-test): Ember accent amber `#E8A33D` → vivid signal orange `#ff5320` (white ink; light `accentText #b33009` for AA), `live` punched up to `#ff5320`/`#ff6b3d` (`liveStrong #e33e0f`/`#ff5320`), `good` brightened to `#16a34a`/`#4ade80`; values only, no architecture, a11y contract still green across all six accent × mode combos | Accepted (owner decision) — supersedes the Ember/`live`/`good` values of ADR-0022 (via 0026/0030); first slice of the July-2026 design refresh |
| [0035](0035-bounded-screens.md) | **Bounded screens**: a page's scroll depth must not grow with the user's workload (design v1) — density shows as fill level, not scroll depth. Pure `boundedList(items, limit, expanded)` primitive (top-N + "+N weitere" drill-in) in `packages/design`; first consumer `ProjectsScreen` (flat list sorted by budget risk, bounded + show-more, per-client grouping retired). Presentation only | Accepted (owner decision) — extends ux-vision §2/§3; viewport-locked shell + Today/Reports consumers follow |
| [0036](0036-first-run-onboarding-gate.md) | **First-run onboarding gate** (design v3): the Welcome → Arbeitszeit → Projekte → Auto-Tracker → Fertig flow shown once per device via a tiny `onboardingStore` seam (`localStorage` on web, in-memory fallback on native) behind `hasOnboarded()`/`markOnboarded()`; `OnboardingGate` sits inside `AuthGate` and seeds synchronously (no flash). Captured answers not yet persisted; presentation + one boolean flag, no deterministic-core impact | Accepted (owner decision) — extends ux-vision §5 and ADR-0035; server-side flag + answer persistence follow |
| 0037–0039 | _Unused — reserved for the closed PRs #172/#173 (offline SQLite / performance); their work is superseded by ADR-0040/0041._ | — |
| [0040](0040-offline-first-local-store-as-sync-client.md) | **Offline-first local store as the sync client**: the device's local SQLite is the *client half* of ADR-0019, not a new architecture. One schema for both modes (carries `workspace_id`/`version`/`updated_at`/`deleted_at`/`device_id`/`operation_id`); the store is a **thin repository** with **no math** — every offline number comes from the same `packages/domain` functions the API uses (offline == online, ADR-0005); standalone = sync-off + synthetic workspace, team = sync-on (ADR-0019 engine). Workspace-scoped by construction | Accepted (owner decision) — extends ADR-0019, bound by ADR-0005; supersedes the offline-only approach of PR #172; delivered via epic #174 (#175–#177) |
| [0041](0041-reanimated-ui-thread-timer.md) | **UI-thread stopwatch (react-native-reanimated)**: the live clock ticks on the UI thread via a display-only `ReanimatedTimer` (Today hero + Island) instead of a per-second `setState` that re-rendered whole screens; `useTimer` drops the tick and exposes raw inputs, source of truth + `formatStopwatch` unchanged (presentation only, ADR-0005 unaffected); Vitest aliases reanimated to a shim (ADR-0027). Cherry-picks the one sound idea from #173 | Accepted (owner decision) — introduces `react-native-reanimated`; other #173 changes rejected/deferred |
| [0042](0042-offline-money-path-in-the-core.md) | **Offline money path in the core**: mirror the server's `rates`/`budgets` tables into the local schema (carrying the ADR-0040 sync/tenancy columns) and compute offline Reports money via `packages/domain` — a single entry-pricing rule (`rateForEntry`) reused by server and client, `priceBillableEntries`/`budgetConsumptions` over local rows. Retires the fabricated demo figures offline; a seeded default rate + budgets make the numbers real from tracked time; overtime stays an honest `0` until offline shifts exist | Accepted (owner decision) — realizes ADR-0040, bound by ADR-0005; delivered via epic #174 (#176) |
| [0043](0043-architecture-simplification-strategy.md) | **Architecture Simplification Strategy**: Phased adoption of Drizzle ORM on the client, Expo Router for navigation, TanStack Query for remote state, and spiking PowerSync/ElectricSQL to potentially replace the custom delta-sync engine. | Proposed |
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
| NestJS 11 (modules/controllers/providers + DI) on `@nestjs/platform-fastify` | Adopt | ADR-0025 |
| nestjs-zod (Zod validation + OpenAPI DTOs) | Adopt | ADR-0025 |
| REST resource endpoints (client↔server API style) | Adopt | ADR-0028 |
| GraphQL (client↔server API) | Hold (declined; read-only BFF facade re-assessable if a need appears) | ADR-0028 |
| tRPC (client↔server API) | Hold (declined — couples RN client to backend TS types) | ADR-0028 |
| reflect-metadata + emitDecoratorMetadata (`apps/api` only; SWC transform in Vitest) | Adopt (scoped to the backend) | ADR-0025 |
| Manual constructor injection (factory modules over typed `deps`) | Superseded by NestJS DI | ADR-0024 → 0025 |
| PostgreSQL | Adopt | ADR-0015 |
| Drizzle ORM (+ drizzle-kit migrations) | Adopt | ADR-0015 |
| React Native + Expo (+ react-native-web, EAS) | Adopt (provisional — spike #1 passed; on-device checklist pending) | ADR-0004 |
| react-native-reanimated + Gesture Handler (Day Canvas 60fps) | Adopt | ADR-0004/0011 |
| expo-sqlite (offline-first local store) | Adopt | ADR-0004/0019 |
| Themable design tokens (`@mydevtime/design`: accent × mode, 3 accents; Blueprint/Königsblau default; density regular/compact, 12-color project palette, absolute soft colors) | Adopt | ADR-0011/0022/0023/0026 |
| `@testing-library/react-native` + `react-test-renderer` (mobile component tests, run by Vitest) | Adopt | ADR-0027 |
| jsdom (DOM env for component tests that mount react-native-web `TextInput` etc., per-file `@vitest-environment`) | Adopt | ADR-0027 |
| react-native-svg (instrument viz: budget rings, balance gauge, sparklines) | Adopt | ADR-0011/0022 (ux-vision §2.5) |
| Inter · Space Grotesk · JetBrains Mono via expo-font / @expo-google-fonts (Blueprint trio) | Adopt | ADR-0022 (font-loading slice) |
| Flutter | Hold (named fallback; not triggered by the spike) | ADR-0004 |
| Stripe (Checkout + Billing) | Adopt | ADR-0006 |
| StoreKit 2 / Play Billing | Adopt | ADR-0006 |
| RevenueCat | Assess (re-evaluate when IAP work starts) | ADR-0006 |
| LLM providers (multi-provider via config) | Adopt (behind one adapter interface) | ADR-0005 |
| OAuth 2.0 connectors (GitHub App, Jira/Atlassian, Slack, Google, GitLab, Linear, MS/Teams, Zoom …) behind a `Connector` port | Adopt (the model; per-connector adapters land incrementally) | ADR-0032/0033 |
| Envelope encryption + AEAD token vault (`TokenVault` port; KMS-sealed in prod) | Adopt (backend a Trial: cloud KMS vs self-hosted AEAD key) | ADR-0032 |
| GitHub App vs OAuth App (connector auth shape) | Assess (open decision) | ADR-0032 |
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
| Provider-agnostic `LlmPort` (ports & adapters for the LLM) | Adopt | ADR-0029 |
| Anthropic (Claude) LLM adapter | Trial (launch rail, behind the port) | ADR-0029 |
| OpenAI LLM adapter | Trial (launch rail, behind the port) | ADR-0029 |
| Google Gemini LLM adapter | Trial (hosted hedge, behind the port) | ADR-0029 |
| Ollama LLM adapter (local/self-hosted) | Trial (privacy + free test rail, behind the port) | ADR-0029 |
| Drizzle ORM (Client-side) | Assess (replacing wa-sqlite raw queries) | ADR-0043 |
| Expo Router | Assess (replacing custom app shell) | ADR-0043 |
| TanStack Query (React Query) | Assess | ADR-0043 |
| Local-first platforms (PowerSync / ElectricSQL) | Assess (spike to replace custom sync) | ADR-0043 |
