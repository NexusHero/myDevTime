# Requirements traceability matrix

_Every requirement in the register maps here to the automated tests that exercise it._

This is the machine-checked bridge between the **Requirements Register**
(`docs/architecture.md` §1, REQ-001…REQ-042) and the test suite. The gate
(`scripts/check-req-coverage.mjs`, run by `./test.sh`) enforces two invariants:

1. **Completeness** — every `REQ-NNN` in the register has a row here. A new
   requirement cannot land without declaring how it is (or will be) verified.
2. **No dead test references** — every test path named in a row must exist on
   disk. Renaming or deleting a test without updating its requirement fails CI,
   so this matrix cannot silently rot.

It does **not** assert that a passing test proves a requirement complete — that
is what code review and the acceptance tier are for. It guarantees that the
_traceability_ is honest and current.

## Coverage states

| State | Meaning |
|-------|---------|
| **Verified** | The requirement's behaviour is exercised by automated tests (unit / integration / acceptance) listed in the row. |
| **Partial** | A load-bearing slice — a domain core, an adapter seam, a shared UI helper — is tested, but the full requirement is not yet delivered. The row names what _is_ covered. |
| **Planned** | Proposed in the register, no implementation yet. The row names the tracking issue; there are no tests to reference. |

## Test tiers (what each layer proves)

- **Domain** (`packages/domain/**/*.test.ts`) — the deterministic core (ADR-0005),
  ≥90 % coverage, purity-gated. Every number that reaches a timesheet, budget,
  export, or invoice is proven here.
- **Design** (`packages/design/**/*.test.ts`) — pure UI geometry / tokens /
  responsive & nav model, ≥90 % coverage.
- **API integration** (`apps/api/**/*.integration.test.ts`) — the real NestJS app
  booted in-process against a real Postgres service container, driven via
  `app.inject()`; includes negative workspace-isolation tests.
- **API unit** (`apps/api/**/*.test.ts`) — guards, config, adapter confinement,
  RFC-7807 mapping.
- **Client** (`apps/mobile/**/*.test.ts(x)`) — API-client parsing/round-trips and
  component render tests (ADR-0027, outside the coverage bar).
- **Acceptance / E2E** (`e2e/**/*.spec.ts`) — the built app driven through a real
  browser against the running Docker stack (ADR-0053).
- **Container smoke** (`scripts/container-smoke.sh`) — black-box HTTP checks
  against the shipped production images (ADR-0052).

---

## Matrix

| REQ | Coverage | Verifying tests | Notes |
|-----|----------|-----------------|-------|
| REQ-001 | Verified | `apps/api/src/modules/tracking/catalog.integration.test.ts`, `apps/api/src/modules/tracking/entries.integration.test.ts`, `apps/api/src/modules/tracking/validation.test.ts` | Workspace-scoped repositories; negative isolation tests assert cross-workspace reads/writes are refused. |
| REQ-002 | Verified | `apps/api/src/modules/auth/auth.integration.test.ts`, `apps/api/src/modules/auth/auth.controller.test.ts`, `apps/api/src/modules/auth/guard.test.ts`, `apps/api/src/modules/auth/confinement.test.ts`, `apps/api/src/config.test.ts`, `apps/mobile/src/api/auth.test.ts`, `apps/mobile/src/screens/LoginScreen.test.tsx`, `apps/mobile/src/screens/RegisterScreen.test.tsx`, `apps/mobile/src/shell/AuthGate.test.tsx`, `e2e/tests/shell-auth.spec.ts` | Email/password + verification, shared `AuthGuard`, Better-Auth vendor confinement; browser acceptance proves sign-in end to end. Client Login + Register (design v8): email sign-in/up, password-reset request, and Google/Apple/GitHub buttons wired to `/sign-in/social` — each enabled only when its OAuth secrets are configured (the public `/api/auth/providers` reports which). |
| REQ-003 | Verified | `packages/domain/src/tracking/time.test.ts`, `packages/domain/src/tracking/overlap.test.ts`, `packages/domain/src/tracking/rounding.test.ts`, `packages/domain/src/tracking/aggregation.test.ts`, `packages/domain/src/tracking/time-entry.test.ts` | Deterministic, dependency-free tracking core; purity-gated (`scripts/check-domain-purity.mjs`). |
| REQ-004 | Verified | `packages/domain/src/tracking/time-entry.test.ts`, `apps/api/src/modules/tracking/entries.integration.test.ts`, `apps/mobile/src/api/timer.test.ts`, `apps/mobile/src/timer/reconcile.test.ts`, `apps/mobile/src/timer/timerStore.test.ts` | One running timer (DB-enforced), manual create/edit/split/delete validated by the core; provenance `source` on every entry. A running **or paused** timer survives an app restart: the server is authoritative for the running segment, the client-only session (banked total + paused context) is persisted locally and merged back by `reconcileTimer`. |
| REQ-005 | Verified | `packages/domain/src/budgets/money.test.ts`, `packages/domain/src/budgets/rates.test.ts`, `packages/domain/src/budgets/pricing.test.ts`, `packages/domain/src/budgets/budget.test.ts`, `packages/domain/src/invoicing/invoice.test.ts`, `packages/domain/src/reporting/rollups.test.ts`, `apps/api/src/modules/billing/invoice.integration.test.ts`, `apps/api/src/modules/billing/export/invoice-pdf.test.ts`, `apps/api/src/modules/billing/billing.integration.test.ts`, `apps/mobile/src/api/invoicing.test.ts`, `apps/mobile/src/reports/revenueBudget.test.ts`, `apps/mobile/src/api/budgets.test.ts`, `apps/mobile/src/api/rates.test.ts`, `apps/mobile/src/screens/RatesScreen.test.tsx` | Integer money math (minor units, BigInt cost); invoicing prices with the same rate math as Reports (ADR-0051); invoice exports as CSV + the design v7 "Rechnung" PDF from the frozen figures (ADR-0054); rates are set per workspace/client/project from the client Rates screen + onboarding default. Reports "Revenue & Budget" (D13): deterministic revenue-per-client + effective rate + open-billable aging (`rollups.ts`), a workspace `GET /api/billing/aging` endpoint, and the client per-client rollup. |
| REQ-006 | Verified | `packages/domain/src/sync/crud.test.ts`, `packages/domain/src/sync/resolve.test.ts`, `packages/domain/src/sync/engine.test.ts`, `packages/domain/src/sync/simulation.test.ts` | **Deferred (ADR-0049):** app is online-only; the deterministic conflict engine is retained and fully tested but unwired as the documented re-entry point. |
| REQ-007 | Verified | `apps/mobile/src/screens/TodayScreen.test.tsx`, `packages/design/src/responsive.test.ts`, `packages/design/src/nav.test.ts`, `e2e/tests/shell-auth.spec.ts` | Today view + responsive split-view model; acceptance proves the shell mounts and a user reaches the app. Native background visibility (Live Activity) is device-only, out of CI. |
| REQ-008 | Verified | `packages/domain/src/reporting/summary.test.ts`, `packages/domain/src/reporting/finance.test.ts`, `apps/api/src/modules/tracking/summary.integration.test.ts`, `apps/api/src/modules/billing/billing-summary.integration.test.ts`, `apps/mobile/src/api/reports.test.ts`, `packages/design/src/instruments.test.ts` | Deterministic summary/finance rollups + the Reports instruments geometry. |
| REQ-009 | Verified | `packages/domain/src/reporting/timesheet.test.ts`, `apps/api/src/modules/billing/export/export.test.ts`, `apps/api/src/modules/billing/export/invoice-csv.test.ts`, `apps/api/src/modules/billing/export/pdf.test.ts`, `apps/api/src/modules/billing/export/export.integration.test.ts` | Every exported number traceable to `buildTimesheet`; CSV/XLSX/PDF serializers behind per-format adapters. |
| REQ-010 | Partial | `apps/api/src/modules/connectors/service.test.ts`, `apps/api/src/modules/connectors/crypto.test.ts`, `apps/mobile/src/api/connectors.test.ts` | Encrypted revocable connector-grant vault + consent seam is tested (ADR-0032/0033); Google/Microsoft calendar read + candidate normalization pending (#15). |
| REQ-011 | Planned | — | Deterministic rules engine — Proposed, tracked by [#16](https://github.com/NexusHero/myDevTime/issues/16). |
| REQ-012 | Verified | `apps/api/src/modules/ai/llm/null-llm.test.ts`, `apps/api/src/modules/ai/llm/vercel-llm.test.ts`, `apps/api/src/modules/boundaries.test.ts` | `LlmPort` (ADR-0029): NullLlm graceful degradation + the single `VercelLlm` adapter; boundaries test confines vendor types. |
| REQ-013 | Verified | `packages/domain/src/nlentry/parse.test.ts`, `apps/api/src/modules/ai/nl-entry.service.test.ts`, `apps/mobile/src/api/nlEntry.test.ts` | Deterministic de/en pre-parser + LLM fallback; always a confirmed draft, never silently persisted. |
| REQ-014 | Partial | `apps/api/src/modules/planner/briefer.test.ts` | AI day-briefing (narrative around domain numbers, plain-template degradation) is tested; standup reports pending (#19). |
| REQ-015 | Verified | `apps/api/src/modules/ai/assistant.test.ts`, `apps/mobile/src/api/assistant.test.ts` | Grounded read-only query tools, defined refusals, no state mutation from chat. |
| REQ-016 | Verified | `packages/domain/src/entitlements/derive.test.ts`, `packages/domain/src/entitlements/features.test.ts`, `apps/api/src/modules/billing/entitlements.integration.test.ts` | Pure `deriveEntitlement` state machine + `can()` gating; idempotent webhook-event convergence, derive-on-read service. |
| REQ-017 | Verified | `apps/api/src/modules/billing/payments/stripe/gateway.test.ts`, `apps/api/src/modules/billing/payments/stripe/stripe.integration.test.ts` | Stripe SDK confined to `billing/payments/stripe`; signature-verified idempotent webhook → entitlement log. |
| REQ-018 | Planned | — | Store subscriptions (StoreKit 2 + Play Billing) — Proposed, tracked by [#23](https://github.com/NexusHero/myDevTime/issues/23). |
| REQ-019 | Partial | `apps/api/src/modules/auth/guard.test.ts`, `apps/api/src/modules/boundaries.test.ts`, `apps/api/src/config.test.ts` | Auth guard, adapter boundaries, and production config validation (secure secret, email-verification lock) are enforced; the full authz-sweep/rate-limit-map/headers deliverable is tracked by [#24](https://github.com/NexusHero/myDevTime/issues/24). |
| REQ-020 | Planned | — | Privacy/DSGVO package (Art. 15 export, Art. 17 erasure) — Proposed, tracked by [#25](https://github.com/NexusHero/myDevTime/issues/25). |
| REQ-021 | Partial | `apps/api/src/db/ready.integration.test.ts` | Readiness/liveness probes tested and smoked in CI (`scripts/container-smoke.sh`, ADR-0052); structured logging + metrics/alerts + rollback drills pending (#26). |
| REQ-022 | Verified | `e2e/tests/shell-auth.spec.ts`, `scripts/container-smoke.sh` | Golden-path acceptance suite lands with ADR-0053: the built app is driven through a real browser against the running stack (app mounts, sign-in works). Both mobile platforms + the 20-green flake gate remain (#27). |
| REQ-023 | Partial | `scripts/container-smoke.sh` | The web image's nginx serves the exported PWA (smoked in CI, ADR-0052); App Store / Play Store distribution + staged rollout pending (#28). |
| REQ-024 | Planned | — | Pricing decision — recorded as an ADR before store submission; tracked by [#29](https://github.com/NexusHero/myDevTime/issues/29). |
| REQ-025 | Planned | — | Meeting transcription pipeline — Proposed, blocked on the capture spike [#31](https://github.com/NexusHero/myDevTime/issues/31). |
| REQ-026 | Planned | — | AI meeting insights — Proposed, tracked by [#33](https://github.com/NexusHero/myDevTime/issues/33). |
| REQ-027 | Verified | `packages/domain/src/credits/ledger.test.ts`, `apps/api/src/modules/billing/credits.integration.test.ts`, `apps/mobile/src/api/credits.test.ts` | Append-only signed deltas → balance/usage derived by the core; debits idempotent on `operationId`; workspace-isolated. |
| REQ-028 | Verified | `packages/domain/src/attendance/worktime.test.ts`, `packages/domain/src/attendance/break-rule.test.ts`, `packages/domain/src/attendance/coverage.test.ts`, `apps/api/src/modules/worktime/punch-clock.integration.test.ts`, `apps/api/src/modules/worktime/worktime-summary.integration.test.ts`, `apps/api/src/modules/worktime/coverage.integration.test.ts`, `apps/mobile/src/api/worktime.test.ts` | Clock-in/out + breaks, effective-dated schedules, overtime balance, ArbZG §4 break-shortfall, project-coverage reconciliation. |
| REQ-029 | Verified | `packages/domain/src/absences/absence.test.ts`, `packages/domain/src/absences/holidays.test.ts`, `apps/api/src/modules/absences/absences.integration.test.ts`, `apps/mobile/src/api/absences.test.ts`, `packages/design/src/calendar.test.ts` | Half-day counting, allowance + carry-over balance, regional holiday calendars, month-grid marks. |
| REQ-030 | Verified | `packages/domain/src/attendance/report.test.ts`, `apps/api/src/modules/worktime/report/render.test.ts`, `apps/api/src/modules/worktime/report/report.integration.test.ts` | `buildWorktimeReport` (absence days credited against target); PDF signature blocks + typed-cell XLSX rendered only from domain values. |
| REQ-031 | Verified | `packages/domain/src/planner/plan.test.ts`, `packages/domain/src/planner/label.test.ts`, `apps/api/src/modules/planner/planner.integration.test.ts`, `apps/api/src/modules/planner/labeler.test.ts`, `apps/mobile/src/api/planner.test.ts`, `apps/mobile/src/components/planner/TaskInbox.test.tsx`, `packages/design/src/planner.test.ts` | Deterministic `buildDayPlan` + `reviewDayPlan`, versioned plan entity, LLM garnish via `PlanLabeler` port (idempotent credit debit), ghost-block canvas + drag geometry. |
| REQ-032 | Partial | `packages/domain/src/insights/balance.test.ts`, `apps/mobile/src/insights/insights.test.ts` | Deterministic `focusStreak` (absence-bridged, in-progress-today graced) + `workloadLoad` (neutral calm/steady/elevated band) over tracked time; client composition of the summary/absence/worktime read models into the Today header chips. Pomodoro cycles + native DND still pending (#41). |
| REQ-033 | Partial | `apps/mobile/src/reminder/reminder.test.ts` | Smart Reminder (§D12): the deterministic `shouldRemindToTrack` rule (clocked in, no active timer, past a threshold, not dismissed) behind the dismissible Today nudge — evidence-based, no surveillance. Trim/punch-correction proposals remain pending (#42). |
| REQ-034 | Planned | — | Calendar write-back — Proposed, tracked by [#43](https://github.com/NexusHero/myDevTime/issues/43). |
| REQ-035 | Planned | — | Dev-tool export (Jira/Linear/Slack) — Proposed, tracked by [#44](https://github.com/NexusHero/myDevTime/issues/44). |
| REQ-036 | Planned | — | Entry notes — Proposed, tracked by [#46](https://github.com/NexusHero/myDevTime/issues/46). |
| REQ-037 | Partial | `packages/design/src/calendar.test.ts` | The deterministic month-grid geometry (activity dots / Woche⇄Monat) is tested; the booking-gap markers + month overview screen pending (#47). |
| REQ-038 | Planned | — | Budget burn-down forecast — Proposed, tracked by [#48](https://github.com/NexusHero/myDevTime/issues/48). |
| REQ-039 | Planned | — | System quick actions (App Intents / Quick Settings Tile) — Proposed, tracked by [#49](https://github.com/NexusHero/myDevTime/issues/49). |
| REQ-040 | Planned | — | Classic day list (Canvas ⇄ Liste) — Proposed, tracked by [#50](https://github.com/NexusHero/myDevTime/issues/50). |
| REQ-041 | Planned | — | Task effort estimation — Proposed, tracked by [#90](https://github.com/NexusHero/myDevTime/issues/90). |
| REQ-042 | Partial | `packages/domain/src/autotracker/activity.test.ts`, `apps/mobile/src/autotracker/capture.test.ts`, `apps/mobile/src/autotracker/activityStore.test.ts` | Auto-Tracker (ADR-0057, **local-only**): deterministic `summarizeActivity` breakdown + the capture port's pure `SpanAccumulator` and first-party `webCapture` adapter + a same-device session buffer (`activityStore`, merged-by-source, cleared on session end) so the split survives a reload without ever leaving the device. Real OS capture (Android/desktop) is a follow-up behind the same port. |

---

## Keeping this current

When you change a requirement, in the **same PR**:

1. Update the register row in `docs/architecture.md` §1.
2. Update this matrix: add the row (new REQ), or move a REQ from **Planned** →
   **Partial** → **Verified** as tests land, naming the exact test paths.
3. `./test.sh` runs `check:req-coverage`, which fails if a register REQ has no
   row here or if a named test path no longer exists.
