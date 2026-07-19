# Backend Subsystems — Component View (C4 Level 3)

This document is the **C4 Level-3 (component) companion** to [`architecture.md`](./architecture.md).
Where the Building Block View there sketches the backend as one NestJS module-per-domain monolith on
the Fastify adapter (its Level-1/2 containers and modules), this document zooms into each backend
subsystem **in isolation** and shows its internal parts, grounded in the code under
`apps/api/src/modules/<name>/`.

Every subsystem is drawn to the same boundary contract, which is the same contract the ADRs impose:

- **The module owns the HTTP edge and persistence.** Controllers mount under `/api/<name>`; a
  per-request `*.context.ts` resolves the caller's workspace over the `DB` token, so isolation holds
  by construction (ADR-0015) — a route can only act on the workspace it resolves, never a
  client-supplied id.
- **The deterministic core is delegated to `packages/domain`.** Every number that reaches a
  timesheet, budget, plan, balance, or invoice is computed by pure, framework-free logic in
  `@mydevtime/domain`; the module persists and proposes, the domain computes (ADR-0005). Domain
  nodes below are drawn as the pure core the service calls into.
- **Volatile vendors sit behind one narrow port each.** LLM, ASR, dev-tool export, calendar, Stripe,
  and Better-Auth are reached through a single adapter that confines the SDK/auth to one file;
  nothing upstream imports a vendor type (skill §2.2). AI/vendor edges are marked
  *proposal only / degrades to Null adapter* — the feature degrades gracefully when the provider is
  absent (the `Null*` adapter is the default seam).

Diagram legend (shared `classDef` across sections): **controller** (HTTP route surface),
**service** (persistence + orchestration), **core** (pure `@mydevtime/domain` logic), **db** (owned
Postgres/Drizzle tables), **port** (narrow vendor interface), **adapter** (vendor-confined
implementation).

For the requirement register, quality goals, and the Runtime View sequences that cut across these
subsystems, see [`architecture.md`](./architecture.md); for the decisions cited here, see
[`adr/README.md`](./adr/README.md).

---

## tracking — entries · catalog · summary

The `tracking` module owns the core time-tracking surface: the client/project/task/tag catalog and
the time entries themselves, including the one-running-timer invariant (REQ-001/004). Its four
controllers (`apps/api/src/modules/tracking/tracking.controller.ts`,
`catalog.controller.ts`, `entries.controller.ts`, `summary.controller.ts`) all sit behind the
`AuthGuard` and resolve their workspace through `TrackingContext`
(`apps/api/src/modules/tracking/tracking.context.ts`), which provisions a workspace on first use and
supplies the owning user id for entry ownership. Deterministic validation stays out of the
controllers: `entries-service.ts` delegates to `isValidEntry` in `@mydevtime/domain`, and the module
never decides an entry's validity itself (ADR-0005). It owns the `timeEntries` and catalog tables
(`clients`, `projects`, `tasks`, `tags`) and provisions `workspaces`.

![tracking — entries · catalog · summary — diagram](diagrams/architecture-subsystems-1.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;

  guard["AuthGuard (from auth)"]
  ctxT["TrackingContext<br/>(workspace + user over DB)"]:::svc

  statusC["TrackingStatusController<br/>GET /api/tracking/status"]:::ctrl
  catC["CatalogController<br/>clients · projects · tasks · tags CRUD"]:::ctrl
  entC["EntriesController<br/>timer/start · timer/stop · running · CRUD · :id/split"]:::ctrl
  sumC["SummaryController<br/>GET /api/tracking/summary"]:::ctrl

  entSvc["entries-service.ts"]:::svc
  sumSvc["summary-service.ts"]:::svc
  val["validation.ts"]:::svc

  core["@mydevtime/domain<br/>isValidEntry (tracking core)"]:::core

  tblEntries[("timeEntries")]:::db
  tblCat[("clients · projects · tasks · tags")]:::db
  tblWs[("workspaces")]:::db

  guard --> statusC & catC & entC & sumC
  catC --> ctxT
  entC --> ctxT
  sumC --> ctxT
  entC --> entSvc
  entC --> val
  sumC --> sumSvc
  entSvc --> core
  entSvc --> tblEntries
  catC --> tblCat
  ctxT --> tblWs
```

</details>

---

## worktime — attendance · schedules · overtime · signable report

The `worktime` module owns the work-time story: punch-clock shifts, weekly schedules, overtime
reconciliation, coverage, and the signable PDF/XLSX work-time report and monthly statement
(REQ-028/030). `worktime.controller.ts` exposes `clock-in`/`clock-out`, `shifts`, `coverage`,
`schedule`, `summary`, `report`, and `statement`; a separate `worktime.status.controller.ts` answers
the status probe. All ArbZG-preset break/overtime arithmetic is delegated to `@mydevtime/domain`
(`computeOvertime`, `breakShortfallMs`, `reconcileCoverage`, `ARBZG_PRESET` in
`apps/api/src/modules/worktime/service.ts`; `buildWorktimeReport`, `zonedTimeToInstant` in
`report/source.ts`; `localParts`/`MonthlyStatement` in `report/statement-source.ts`). The module owns
`attendanceShifts` and `workSchedules` and reads `timeEntries`, `projects`, and `absences` when it
composes a report. Rendering (`report/pdf.ts`, `report/xlsx.ts`, `report/statement-pdf.ts`) formats a
report the domain already computed — it never re-does the math.

![worktime — attendance · schedules · overtime · signable report — diagram](diagrams/architecture-subsystems-2.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;

  guard["AuthGuard (from auth)"]
  ctxW["WorktimeContext"]:::svc

  wtC["WorktimeController<br/>clock-in · clock-out · running · shifts · coverage · schedule · summary · report · statement"]:::ctrl
  wtStatusC["WorktimeStatusController<br/>GET /api/worktime/status"]:::ctrl

  svc["service.ts"]:::svc
  repSrc["report/source.ts · statement-source.ts"]:::svc
  render["report/pdf.ts · xlsx.ts · statement-pdf.ts<br/>(format only)"]:::svc

  core["@mydevtime/domain<br/>computeOvertime · breakShortfallMs · reconcileCoverage<br/>buildWorktimeReport · ARBZG_PRESET · localParts"]:::core

  tblShifts[("attendanceShifts")]:::db
  tblSched[("workSchedules")]:::db
  tblRead[("timeEntries · projects · absences (read)")]:::db

  guard --> wtC & wtStatusC
  wtC --> ctxW
  wtC --> svc
  wtC --> repSrc
  repSrc --> render
  svc --> core
  repSrc --> core
  svc --> tblShifts
  svc --> tblSched
  repSrc --> tblRead
```

</details>

---

## absences — leave · vacation policy & balance · holidays

The `absences` module owns leave ranges, the per-workspace vacation policy, and holiday-calendar
lookups (REQ-029). `absences.controller.ts` lists and creates leave, deletes it, reads and writes the
`policy`, reports the `balance`, and serves `holidays`; `absences.status.controller.ts` answers the
probe. Allowance arithmetic is not done in the service: `apps/api/src/modules/absences/service.ts`
hands stored rows to the deterministic `vacationBalance` core, and the controller resolves public
holidays through `holidaysForRegion`/`HOLIDAY_REGIONS` in `@mydevtime/domain` (ADR-0005/0010). It owns
`absences` and `absencePolicies`.

![absences — leave · vacation policy & balance · holidays — diagram](diagrams/architecture-subsystems-3.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;

  guard["AuthGuard (from auth)"]
  ctxA["AbsencesContext"]:::svc

  absC["AbsencesController<br/>GET/POST / · DELETE :id · GET/PUT policy · GET balance · GET holidays"]:::ctrl
  absStatusC["AbsencesStatusController<br/>GET /api/absences/status"]:::ctrl

  svc["service.ts"]:::svc

  core["@mydevtime/domain<br/>vacationBalance · holidaysForRegion · HOLIDAY_REGIONS"]:::core

  tblAbs[("absences")]:::db
  tblPol[("absencePolicies")]:::db

  guard --> absC & absStatusC
  absC --> ctxA
  absC --> svc
  absC --> core
  svc --> core
  svc --> tblAbs
  svc --> tblPol
```

</details>

---

## planner — versioned day plans · Co-Planner review

The `planner` module owns versioned day plans and the Co-Planner review (REQ-031). `planner.controller.ts`
lists and creates plans, transitions a plan's `status`, serves the plan-vs-actual `review`, computes
deterministic `label`s, and produces a `briefing`. Placement is not done in the service:
`apps/api/src/modules/planner/service.ts` runs the deterministic `buildDayPlan` and `reviewDayPlan`
cores and stores their blocks verbatim — it never places time itself (ADR-0005/0011). `labeler.ts`
delegates to `deterministicLabels`, and `briefer.ts` composes a briefing over the domain `DayPlan`
type. It owns `plans` and reads `timeEntries` for the plan-vs-actual review.

![planner — versioned day plans · Co-Planner review — diagram](diagrams/architecture-subsystems-4.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;

  guard["AuthGuard (from auth)"]
  ctxP["PlannerContext"]:::svc

  plnC["PlannerController<br/>GET/POST plans · POST plans/:id/status · GET plans/:id/review · POST plans/:id/label · POST plans/:id/briefing"]:::ctrl
  plnStatusC["PlannerStatusController<br/>GET /api/planner/status"]:::ctrl

  svc["service.ts"]:::svc
  lab["labeler.ts"]:::svc
  brief["briefer.ts"]:::svc

  core["@mydevtime/domain<br/>buildDayPlan · reviewDayPlan · deterministicLabels"]:::core

  tblPlans[("plans")]:::db
  tblEntries[("timeEntries (read — plan vs actual)")]:::db

  guard --> plnC & plnStatusC
  plnC --> ctxP
  plnC --> svc
  plnC --> lab
  plnC --> brief
  svc --> core
  lab --> core
  svc --> tblPlans
  svc --> tblEntries
```

</details>

---

## automation — deterministic categorization rules

The `automation` module owns the deterministic categorization rules engine (REQ-011).
`rules.controller.ts` is CRUD over stored `matcher → action` rules plus a `rules/dry-run` that
previews matches and writes nothing; `automation.controller.ts` answers the status probe. Evaluation
is never decided by the service: `apps/api/src/modules/automation/service.ts` delegates every match to
the `dryRun` engine in `@mydevtime/domain`, so a rule's behaviour is pure, exhaustively tested logic
(ADR-0005). It owns the `rules` table.

Note on scope: the `automation` module is rules-only. **Calendar ingestion is not in this module** —
it lives in `connectors` (the `google-calendar/preview` route) over the `calendarsync` port and the
deterministic `mergeCalendar` core; see the *connectors* section below.

![automation — deterministic categorization rules — diagram](diagrams/architecture-subsystems-5.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;

  guard["AuthGuard (from auth)"]
  ctxAu["AutomationContext"]:::svc

  rulesC["RulesController<br/>GET/POST rules · GET/PATCH/DELETE rules/:id · POST rules/dry-run"]:::ctrl
  autoStatusC["AutomationController<br/>GET /api/automation/status"]:::ctrl

  svc["service.ts<br/>(persist matcher/action; dry-run writes nothing)"]:::svc

  core["@mydevtime/domain<br/>dryRun (rules engine)"]:::core

  tblRules[("rules")]:::db

  guard --> rulesC & autoStatusC
  rulesC --> ctxAu
  rulesC --> svc
  svc --> core
  svc --> tblRules
```

</details>

---

## ai — LLM · ASR · assistant · insights · export (proposals only)

The `ai` module is the AI layer's HTTP surface and the largest subsystem. `ai.controller.ts` exposes
`nl-entry`, `smart-add`, `insight`, `standup`, `categorize`, and `assistant`; a nested
`export/export.controller.ts` serves the confirmed-only dev-tool export ledger (`export/records`,
`export/run`). Everything the LLM/ASR produces is a **proposal** the deterministic core validates
(ADR-0005): `nl-entry.service.ts`/`smart-add.service.ts` delegate to `parseTimeEntry`/`parseEntry`,
`assistant.ts` grounds answers with `selectGroundingFacts`/`isOffData`, `standup.ts` uses
`buildStandup`/`standupSlots`, and `transcription/service.ts` runs `actionItemProposals`/`transcriptFacts`
after gating on stored consent (REQ-025).

Three narrow ports keep the vendors confined, each defaulting to a `Null*` adapter that ships now as
the seam and degrades gracefully when no provider is configured:

- **`LlmPort`** (`ai/llm/port.ts`) — every model (OpenAI, Anthropic, Gemini, Ollama) reached through
  one library-backed adapter (`ai/llm/vercel-llm.ts`); `NullLlm` is the default.
- **`TranscriptionPort`** (`ai/transcription/port.ts`) — ASR behind `whisper-http.ts`; `NullTranscription`
  the default, gated on spike #31.
- **`ExportTargetPort`** (`ai/export/port.ts`) — Jira/Linear/Slack behind confined adapters; idempotent,
  confirmed-only; `NullExportTarget` the default.

Credit-priced routes debit the billing ledger through the billing module's **public contract** only:
`ai.controller.ts` imports `balanceFor`/`debit` from `../billing/contract.js`, and a credit is charged
once **only when the AI actually proposed** — a down provider or a deterministic fallback costs nothing
(ADR-0008). The module owns `exportRecords` (the export ledger) and reads grounding data from
`timeEntries`/`plans`/`workspaces`.

![ai — LLM · ASR · assistant · insights · export (proposals only) — diagram](diagrams/architecture-subsystems-6.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;
  classDef port fill:#fdeef6,stroke:#b83280,color:#702459;
  classDef adapter fill:#fbeaea,stroke:#c53030,color:#742a2a;
  classDef ext fill:#eaf6f6,stroke:#2c7a7b,color:#234e52;

  guard["AuthGuard (from auth)"]
  ctxAi["AiContext (workspace over DB)"]:::svc

  aiC["AiController<br/>POST nl-entry · smart-add · insight · standup · categorize · assistant"]:::ctrl
  expC["ExportController<br/>GET export/records · POST export/run"]:::ctrl

  nlSvc["nl-entry · smart-add · assistant · insights · standup · categorize services"]:::svc
  trSvc["transcription/service.ts<br/>(consent-gated, REQ-025)"]:::svc
  expSvc["export/service.ts + ledger.ts"]:::svc

  core["@mydevtime/domain<br/>parseTimeEntry · parseEntry · selectGroundingFacts · isOffData<br/>buildStandup · actionItemProposals · transcriptFacts"]:::core

  llmPort["LlmPort"]:::port
  trPort["TranscriptionPort"]:::port
  expPort["ExportTargetPort"]:::port

  llmAd["vercel-llm.ts / NullLlm<br/>proposal only / degrades to Null"]:::adapter
  trAd["whisper-http.ts / NullTranscription<br/>proposal only / degrades to Null"]:::adapter
  expAd["jira · linear · slack / NullExportTarget<br/>confirmed-only, idempotent / degrades to Null"]:::adapter

  billing["billing contract.js<br/>balanceFor · debit (credit ledger)"]:::ext

  tblExp[("exportRecords")]:::db
  tblRead[("timeEntries · plans · workspaces (read — grounding)")]:::db
  tblCredit[("creditEntries — debited via billing contract")]:::db

  guard --> aiC & expC
  aiC --> ctxAi
  aiC --> nlSvc
  aiC --> trSvc
  nlSvc --> core
  trSvc --> core
  nlSvc --> llmPort
  trSvc --> trPort
  llmPort --> llmAd
  trPort --> trAd
  aiC --> billing
  billing --> tblCredit
  expC --> expSvc
  expSvc --> expPort
  expPort --> expAd
  expSvc --> tblExp
  nlSvc --> tblRead
```

</details>

---

## billing — rates · budgets · invoicing · entitlements · credit ledger · Stripe rail

The `billing` module owns money and access: rate cards, budgets and thresholds, invoices/Abrechnung,
the credit ledger, and derived entitlements (REQ-005/009/016/017). `billing.controller.ts` carries the
bulk of the surface (`rates`, `budgets` + `status`/`evaluate`/`burndown`, `projects/:id/cost` and
`timesheet`, `summary`, `aging`, `invoices` + `preview`/`export`, `credits` + `ledger`/`usage`,
`entitlement`); `stripe.controller.ts` runs the payment rail (`checkout`, `portal`,
`stripe/webhook`); `billing.status.controller.ts` answers the probe. Every figure is deterministic
domain logic: `service.ts` (`budgetStatus`, `costOf`, `rateForEntry`, `evaluateThresholds`),
`invoice-service.ts` (`invoiceLines`, `summarizeInvoice`, `agingBuckets`), `credits-service.ts`
(`creditBalance`, `canDebit`, `monthlyCreditAllowance`, `usageByCategory`), and `entitlements-service.ts`
(`deriveEntitlement`, `can`, `featuresFor`). The Stripe SDK stays inside `payments/stripe/gateway.ts`
behind the `payments/port.ts` interface; the gateway provider resolves to `null` when Stripe is
unconfigured and the controller answers 404 (ADR-0006/0008). It owns `rates`, `budgets`,
`budgetAlerts`, `invoices`, `creditEntries`, `entitlementEvents`, and `billingCustomers`, and reads
`timeEntries`/`projects`/`clients` for costing.

![billing — rates · budgets · invoicing · entitlements · credit ledger · Stripe rail — diagram](diagrams/architecture-subsystems-7.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;
  classDef port fill:#fdeef6,stroke:#b83280,color:#702459;
  classDef adapter fill:#fbeaea,stroke:#c53030,color:#742a2a;

  guard["AuthGuard (from auth)"]
  ctxB["BillingContext (workspace over DB)"]:::svc

  billC["BillingController<br/>rates · budgets(+status/evaluate/burndown) · cost · timesheet · summary · aging · invoices(+preview/export) · credits(+ledger/usage) · entitlement"]:::ctrl
  stripeC["StripeController<br/>POST checkout · portal · stripe/webhook"]:::ctrl
  billStatusC["BillingStatusController<br/>GET /api/billing/status"]:::ctrl

  svc["service.ts"]:::svc
  invSvc["invoice-service.ts"]:::svc
  credSvc["credits-service.ts"]:::svc
  entSvc["entitlements-service.ts"]:::svc
  tsSrc["export/timesheet-source.ts + renderers"]:::svc

  core["@mydevtime/domain<br/>budgetStatus · costOf · rateForEntry · evaluateThresholds<br/>invoiceLines · summarizeInvoice · agingBuckets<br/>creditBalance · canDebit · deriveEntitlement · buildTimesheet"]:::core

  port["payments/port.ts (payment rail)"]:::port
  gw["payments/stripe/gateway.ts<br/>Stripe SDK confined / null when unconfigured (404)"]:::adapter

  tblMoney[("rates · budgets · budgetAlerts · invoices")]:::db
  tblCred[("creditEntries")]:::db
  tblEnt[("entitlementEvents · billingCustomers")]:::db
  tblRead[("timeEntries · projects · clients (read)")]:::db

  guard --> billC & stripeC & billStatusC
  billC --> ctxB
  billC --> svc & invSvc & credSvc & entSvc & tsSrc
  svc --> core
  invSvc --> core
  credSvc --> core
  entSvc --> core
  tsSrc --> core
  stripeC --> port
  port --> gw
  gw --> tblEnt
  svc --> tblMoney
  credSvc --> tblCred
  entSvc --> tblEnt
  invSvc --> tblMoney
  svc --> tblRead
```

</details>

---

## connectors — OAuth vault · per-capability consent · calendar adapter

The `connectors` module owns third-party connections: real per-connector state, per-capability
consent, and the sealed OAuth token vault (M3, ADR-0032/0033). `connectors.controller.ts` lists
connectors, runs the OAuth `:id/authorize`/`:id/callback` flow, patches per-capability `:id/consent`,
disconnects (`DELETE :id`, which deletes sealed tokens and revokes every grant), and serves the
consent-gated `google-calendar/preview`. Secrets are confined: `vault.ts` seals/opens tokens over the
`crypto.ts` backend (ports & adapters — the master key lives only in the environment), and `consent.ts`
enforces that nothing runs without a stored, explicit opt-in (consent-first, REQ-025). This is where
**calendar ingestion** lives: the preview delegates to `planImport` (`calendarsync/service.ts`) over the
`CalendarPort` (`calendarsync/port.ts`, `GoogleCalendar`/`NullCalendar` adapters), which reads a window
and yields the deterministic `mergeCalendar` ghost-block **proposals** — it books nothing (ADR-0005). It
owns `connectorTokens` and `connectorGrants`.

![connectors — OAuth vault · per-capability consent · calendar adapter — diagram](diagrams/architecture-subsystems-8.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef core fill:#fff5e6,stroke:#dd6b20,color:#7b341e;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;
  classDef port fill:#fdeef6,stroke:#b83280,color:#702459;
  classDef adapter fill:#fbeaea,stroke:#c53030,color:#742a2a;

  guard["AuthGuard (from auth)"]
  ctxC["ConnectorsContext (workspace + user over DB)"]:::svc

  conC["ConnectorsController<br/>GET / · GET google-calendar/preview · GET :id/authorize · GET :id/callback · PUT :id/consent · DELETE :id"]:::ctrl

  svc["service.ts (status + OAuth-URL assembly)"]:::svc
  consent["consent.ts (per-capability opt-in, REQ-025)"]:::svc
  vault["vault.ts (seal / open tokens)"]:::svc
  reg["registry.ts (connector specs · scopes)"]:::svc

  crypto["crypto.ts<br/>crypto backend confined / master key in env"]:::adapter

  calSvc["calendarsync/service.ts — planImport"]:::svc
  calCore["@mydevtime/domain<br/>mergeCalendar (ghost-block proposals)"]:::core
  calPort["CalendarPort (calendarsync/port.ts)"]:::port
  calAd["GoogleCalendar / NullCalendar<br/>read only, proposal only / degrades to Null"]:::adapter

  tblTok[("connectorTokens")]:::db
  tblGrant[("connectorGrants")]:::db

  guard --> conC
  conC --> ctxC
  conC --> svc
  conC --> consent
  conC --> vault
  svc --> reg
  vault --> crypto
  vault --> tblTok
  consent --> tblGrant
  conC --> calSvc
  calSvc --> calPort
  calSvc --> calCore
  calPort --> calAd
```

</details>

---

## auth — Better-Auth edge (authN & sessions)

The `auth` module owns authentication and the shared guard (ADR-0017/0025). `auth.controller.ts`
serves the Nest-routed `status`, `providers`, and `me`, while the Better-Auth `/api/auth/*`
catch-all is mounted directly on the raw Fastify instance at bootstrap (its wire format bypasses Nest
routing/validation by design). The vendor is confined to this module: `auth-instance.ts` builds the
Better-Auth instance (null without a DB), `email-port.ts` is the narrow email seam, and `AuthGuard`
(`auth.guard.ts`) validates the session and attaches a vendor-free `AuthenticatedUser` to the request.
Every other module imports only this module's public surface — `contract.ts` re-exports `AuthGuard`
and `CurrentUser`, and `auth.module.ts` exports the guard for `@UseGuards`. It reads the Better-Auth
schema (`user`/session tables); Better-Auth types never leak upstream.

![auth — Better-Auth edge (authN & sessions) — diagram](diagrams/architecture-subsystems-9.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TD
  classDef ctrl fill:#e3f0ff,stroke:#2b6cb0,color:#1a365d;
  classDef svc fill:#eef7ee,stroke:#38a169,color:#1c4532;
  classDef db fill:#f0f0f5,stroke:#718096,color:#2d3748;
  classDef adapter fill:#fbeaea,stroke:#c53030,color:#742a2a;
  classDef port fill:#fdeef6,stroke:#b83280,color:#702459;

  authC["AuthController<br/>GET status · providers · me"]:::ctrl
  catchall["/api/auth/* catch-all<br/>(mounted on raw Fastify at bootstrap)"]:::ctrl

  guard["AuthGuard (canActivate → AuthenticatedUser)<br/>exported via contract.ts for every module"]:::svc
  inst["auth-instance.ts<br/>Better-Auth confined / null without DB"]:::adapter
  email["email-port.ts (narrow email seam)"]:::port

  tblUser[("user / session (Better-Auth schema)")]:::db

  authC --> guard
  catchall --> inst
  guard --> inst
  inst --> email
  inst --> tblUser
```

</details>

---

_These nine subsystem views complement the Building Block View in [`architecture.md`](./architecture.md);
keep a subsystem's diagram current in the same PR that changes its controllers, its owned tables, or
its ports (skill §1.5)._
