# Eight-perspective quality & bug audit — 2026-07-15

An intensive, multi-perspective quality and bug audit of the myDevTime repository (current
`main`). Eight views were fanned out in parallel — Requirements Engineer, Architect, Software
Developer, DevOps Engineer, Tester, UX Designer, Customer/User, and Security & Correctness — and
every candidate finding was re-checked by a second, skeptical pass whose goal was to *disprove*
it. Only findings that survived that verification are reported here: **39 confirmed findings**
across the eight perspectives.

This page is linked from [the architecture document](../architecture.md) (§ Audits) so the audit
trail lives inside the architecture record.

Findings that the same defect produced from more than one perspective are consolidated into a
single entry below, with every view that raised it noted; the deduplicated report therefore lists
**30 unique defects** carrying the 39 confirmed perspective-findings. Each entry records:
severity, the view(s) that raised it, `FAKT`/`RISIKO` (fact vs. risk), the location as
`file:line`, the problem, a concrete failure scenario, and the fix with an effort estimate
(S/M/L).

> Note on scope: this document is the audit record only. The fixes are tracked separately (a
> security PR owns the credit/entitlement/workspace endpoints); nothing here was silently
> changed.

## Prompt

The audit was run from the following prompt (verbatim):

```
Führe einen intensiven, mehrperspektivischen Qualitäts- und Bug-Audit dieses Repos durch. Arbeite AUTONOM und vollständig – frag mich NICHT zwischendurch, sondern liefere am Ende einen einzigen, priorisierten Bericht. Wenn dir ein Workflow-/Subagent-Mechanismus zur Verfügung steht, fächere die Sichten parallel auf; jede gefundene Schwachstelle wird von einem zweiten, skeptischen Durchgang GEGENGEPRÜFT (Ziel: sie zu widerlegen) – nur bestätigte Befunde kommen in den Bericht. Acht Sichten: 1. Requirements Engineer, 2. Architekt, 3. Softwareentwickler, 4. DevOps Engineer, 5. Tester, 6. UX Designer, 7. Kunde/Nutzer, 8. Security & Korrektheit. Regeln: echten Code lesen (file:line), FAKT/RISIKO/MEINUNG trennen, keine Fehlalarme. Output: ein Markdown-Bericht priorisiert nach Severity (Severity, Sicht, Ort file:line, Problem, Fehlszenario, Fix mit Aufwand S/M/L) + eine "Was ich zuerst fixen würde"-Liste.
```

## Findings

### Blocker

#### B1 — Any authenticated user can self-mint unlimited AI credits · RISIKO

- **View:** Security & Correctness
- **Location:** `apps/api/src/modules/billing/billing.controller.ts:248`
- **Problem:** `POST /api/billing/credits/grant` is exposed to any session-authenticated user and
  calls `credits.grant` on the caller's own workspace with a fully client-supplied positive amount
  (`GrantDto: amount z.number().int().positive()`, `billing.dto.ts:32-40`), behind only
  `AuthGuard` — no admin/role check. This lets any user mint unlimited AI credits for themselves,
  defeating the credit-based monetization (ADR-0008). Every AI feature (assistant, co-planner
  label/briefing, NL entry) debits this ledger, so free credits make them all free.
- **Failure scenario:** A free user with 0 credits sends
  `POST /api/billing/credits/grant {"amount":1000000,"category":"topup"}`. `balanceFor` now
  returns 1000000; `POST /api/ai/assistant` and `/api/planner/plans/:id/label` succeed
  indefinitely without any purchase.
- **Fix (S):** Remove/lock down the grant (and debit) HTTP endpoints. Credit grants must
  originate only from verified purchase/entitlement events processed by the payment adapters, or
  from an admin-guarded surface — never from a session-authenticated self-service route.

#### B2 — Any authenticated user can self-grant a Pro subscription · FAKT

- **View:** Security & Correctness
- **Location:** `apps/api/src/modules/billing/billing.controller.ts:312`
- **Problem:** `POST /api/billing/entitlement/events` is exposed to any session-authenticated user
  and writes an entitlement event for the caller's own workspace. `entitlements-service.recordEvent`
  (`entitlements-service.ts:54`) appends the client-supplied event, and
  `getEntitlement`/`deriveEntitlement` derives the plan from the log — a `subscribed` event with
  status `active` yields plan `pro` (`domain/entitlements/derive.ts:37-40,136`). The service
  docstring says this seam is meant to be called only by the verified payment adapters after a
  webhook, yet it is mounted as a plain HTTP route behind only `AuthGuard` (no role/admin check,
  no provider-signature check). Complete monetization bypass: a user self-grants a paid
  subscription for free, unlocking all Pro features (`ai_proposals`, `calendar_integration`,
  `meeting_transcription`, `advanced_reports`).
- **Failure scenario:** Any logged-in free user sends
  `POST /api/billing/entitlement/events {"providerEventId":"x","source":"promo","type":"subscribed","effectiveAt":"2026-07-15T00:00:00Z"}`
  (periodEnd omitted → unbounded). `GET /api/billing/entitlement` now returns plan `pro`
  permanently; every Pro feature gate (`checkFeature`) passes. No payment ever occurred.
- **Fix (S):** Remove this HTTP endpoint. Entitlement events must be written only by the
  payment-provider adapters after verifying provider authenticity (Stripe webhook signature,
  App Store/Play server notifications) — the same trust model the Stripe webhook already uses.
  `recordEvent` should be an internal module seam, never reachable with a session cookie.

#### B3 — Non-atomic workspace provisioning fragments a new user's data · RISIKO

- **Views:** Architect, Software Developer
- **Location:** `apps/api/src/core/workspace.ts:17`
- **Problem:** `resolveWorkspaceId()` is a non-atomic read-then-insert (SELECT membership, and if
  none, INSERT a new workspace + membership). It is called per-request by **every** module
  context (tracking/ai/planner/absences/billing/preferences/connectors/worktime). The
  `workspace_members` table has only a composite PK `(workspace_id, user_id)` — no unique
  constraint on `user_id` alone (`catalog-schema.ts:46-59`) — so concurrent first-use requests
  each create their own workspace and each insert a distinct membership row without any conflict.
  The subsequent lookup SELECT has no `ORDER BY` and a `.limit(1)`, so which of the duplicate
  workspaces wins is nondeterministic per query.
- **Failure scenario:** A brand-new user opens the app. The client fires many parallel
  authenticated requests on first load (`useReports` alone does `Promise.all` of 5 fetches, plus
  useSession/useCredits/usePreferences/useTimer). All run `resolveWorkspaceId` concurrently, none
  see a membership row yet, so N workspaces + N membership rows are created for the one user.
  Afterwards, entries written under workspace A become invisible whenever a later request's
  unordered `limit(1)` resolves to workspace B — the user's tracked time and money appear to
  vanish, and isolation-by-construction is broken.
- **Fix (M):** Make provisioning atomic and single-valued: add a UNIQUE constraint on
  `workspace_members.user_id` (one personal workspace per user at 1.0), and insert membership with
  `onConflictDoNothing` then re-select, or wrap create+insert in a transaction with
  `SELECT ... FOR UPDATE` / an advisory lock keyed on `userId`. Add a deterministic `ORDER BY` to
  the lookup as defense-in-depth.

### Hoch

#### H1 — `startTimer` can persist a negative-duration entry that 500s the whole billing surface · FAKT

- **View:** Architect
- **Location:** `apps/api/src/modules/tracking/entries-service.ts:66`
- **Problem:** `startTimer()` stops any already-running timer by blindly setting its `endedAt` to
  the NEW timer's `startedAt`, with no validation that `startedAt` is at/after the running row's
  own `startedAt`. `startedAt` is client-controllable (`StartTimerDto.startedAt: wireDate.optional()`,
  `tracking.dto.ts:63`). `stopTimer()` explicitly guards this exact case via `assertValid()`, but
  the implicit stop inside `startTimer()` does not.
- **Failure scenario:** A timer is running with `startedAt=10:00`. The client POSTs `/timer/start`
  with `startedAt=09:00` (a backdated start while a timer runs). The update sets the previous
  row's `endedAt=09:00`, persisting a completed entry with end (09:00) < start (10:00) — a
  negative-duration row. That row then reaches the deterministic money core: `costOf()`
  (`money.ts:38`) and `roundDuration()` (`rounding.ts:24`) THROW on a negative duration, so
  `billingSummary` / `projectCost` / `buildTimesheet` / invoice export 500 for the whole
  workspace — corrupt data plus a denial of the entire reporting/billing surface.
- **Fix (S):** In `startTimer`'s transaction, load the running row and either reject
  (`ValidationError`) when the incoming `startedAt` precedes it, or clamp the stop to
  `max(startedAt, running.startedAt)`; run the same `assertValid()` the stop path already uses.

#### H2 — Credit debit overdraws below zero under concurrency · RISIKO

- **Views:** Architect, Software Developer, Tester, Security & Correctness
- **Location:** `apps/api/src/modules/billing/credits-service.ts:148`
- **Problem:** `debit()` runs the overdraw check as SELECT-all-entries → `canDebit` → INSERT
  inside a plain `db.transaction()` with no locking. Postgres default isolation is READ COMMITTED,
  and the two competing debits insert DISTINCT rows, so there is no row-level conflict to serialize
  them. The `onConflictDoNothing` idempotency key (the `credit_entries_op_idem` partial unique
  index) only protects re-delivery of the SAME `operationId`; it does nothing for two different
  concurrent debits. The integration suite's `RefusesToOverdraw`
  (`credits.integration.test.ts:81`) only exercises the sequential path, so the ledger's core
  safety invariant is untested under concurrency.
- **Failure scenario:** Balance is 10 credits. Two AI operations with different `operationId`s
  debit 8 each at the same moment. Both transactions SELECT the ledger before either commits, both
  compute balance=10, both pass `canDebit(…,8)`, both insert. Final balance = -6: the workspace
  consumed more paid AI credit than it holds — the credit gate is bypassed under concurrency.
- **Fix (M):** Serialize debits per workspace: take a per-workspace lock before the balance read
  (`SELECT ... FOR UPDATE` on a workspace/balance row, or `pg_advisory_xact_lock(hash(workspaceId))`),
  or run the transaction at SERIALIZABLE isolation with retry-on-40001. Add a concurrency
  integration test that issues N debits summing to more than the balance and asserts the balance
  never goes negative.

#### H3 — Every API replica runs migrations on boot with no lock → deploy crash-loop · RISIKO

- **View:** DevOps
- **Location:** `apps/api/Dockerfile:38`
- **Problem:** The container CMD is `node dist/db/migrate.js && node dist/main.js` — every API
  instance runs the migrations at startup. The Drizzle postgres-js migrator takes NO advisory lock:
  in `drizzle-orm@0.45.2` `pg-core/dialect.js` (`migrate`, lines 44-70) it reads the last applied
  migration and then executes the pending DDL in a transaction without `pg_advisory_lock`. Two
  processes starting at the same time read the same state and run the same DDL twice.
- **Failure scenario:** `kubectl scale api --replicas=3` (or a rolling deploy that starts new pods
  while a migration is pending): all three pods read `lastDbMigration=N`, enter the transaction and
  run the `CREATE TABLE ...`/`ALTER ...` of migration N+1. One pod commits; the others abort with
  "relation already exists"/duplicate → crash-loop, deploy blocked.
- **Fix (M):** Move migrations out of the app-start CMD: run them as a separate, one-shot deploy
  step / init job (k8s Job, ECS pre-deploy task), or wrap `migrate()` in `migrate.js` with a
  `pg_advisory_lock`/`pg_try_advisory_lock` so only one process migrates at a time.

#### H4 — Today hero "What are you working on?" input is silently discarded · FAKT

- **Views:** UX Designer, Customer/User
- **Location:** `apps/mobile/src/screens/TodayScreen.tsx:127` (Start press at `:279`)
- **Problem:** The Today hero tracker's central "What are you working on?" `TextInput`
  (lines 127-142) writes to local `task` state that is read nowhere except its own `value` binding
  (grep confirms only lines 70,128). The Start button calls `timer.punchIn()` with no argument
  (line 279), even though `punchIn(input?: StartTimerInput)` accepts one and `StartTimerInput`
  carries a `note` field. The typed description is silently discarded and never attached to the
  started entry, and the text stays in the box giving the impression it was captured.
- **Failure scenario:** User types "Design review" in the hero bar and taps the green Start button.
  The timer starts, an entry is created with no description, and "Design review" remains sitting in
  the input with no signal it was ignored.
- **Fix (M):** Thread the input into the start call:
  `timer.punchIn(task.trim() ? { note: task.trim() } : undefined)` and clear/reflect `task` on
  punch-in; or bind the field to the running entry's note.

#### H5 — ProjectsScreen ships untranslated German UI copy · FAKT

- **View:** UX Designer
- **Location:** `apps/mobile/src/screens/ProjectsScreen.tsx:101`
- **Problem:** ProjectsScreen ships German UI copy despite the English-only binding rule and the
  prior English translation pass. Concrete literals: `Aufgaben` (54), `Budget knapp` (101),
  `Gebucht` (117), `Kein Budget-Cap` (132), `nach Budget-Risiko` (267), `Minute 1 Vorschau` (306),
  `Offen abrechenbar` (354), `Abrechnen` (368), `Abgerechnet` (380),
  `Weniger anzeigen` / `+N weitere anzeigen` (451). The header title "Projects" is English, so the
  same screen mixes two languages.
- **Failure scenario:** An English-locale user opens the Projects tab and sees a card headed
  "Projects" but body text "Budget knapp", "Gebucht", "Kein Budget-Cap", and a footer button
  "+3 weitere anzeigen" — untranslated German.
- **Fix (S):** Translate all listed literals to English (Tasks, Budget tight, Booked, No budget
  cap, by budget risk, Minute 1 preview, Open billable, Invoice, Invoiced, Show fewer / +N more).

#### H6 — Planner week-header shows a fabricated, unchanging week total · FAKT

- **View:** UX Designer
- **Location:** `apps/mobile/src/screens/PlannerScreen.tsx:1106`
- **Problem:** The Planner week-header renders a hardcoded, fabricated week total:
  `<Text>26.1h</Text> / 41:40h` (line 1106). The week canvas has no real data (`DEMO_BLOCKS` is
  `[]` at line 127) and each day column shows total `—` (`buildWeek` sets `total:'—'`, line 118),
  yet the header always presents a concrete "26.1h / 41:40h" regardless of week or actual tracked
  time. It also violates the deterministic-formatter mandate and mixes two duration formats in one
  label: "26.1h" (decimal) vs "41:40h" (H:MM), neither produced by `formatDuration`.
- **Failure scenario:** User opens Planner with zero tracked time; the empty grid and every day
  total read "—", but the header confidently reports "26.1h / 41:40h" worked — a number that never
  changes across weeks and matches nothing on screen.
- **Fix (S):** Derive the total from real blocks/plan via `formatDuration`, or drop the total until
  a live aggregate exists (consistent with the day totals showing "—").

#### H7 — Planner week (KW) selector is a dead affordance · FAKT

- **View:** UX Designer
- **Location:** `apps/mobile/src/screens/PlannerScreen.tsx:1088`
- **Problem:** The KW week selector is a dead affordance. Prev/Next only mutate the `week` counter
  (`setWeek` at 1072/1091) which feeds solely the "Week {week}" label (1088) and some inbox message
  text. The day columns come from `weekDays = buildWeek()` (line 124), computed once for the real
  current Mon-Fri and never re-derived from `week`; the canvas blocks, dates, today-highlight and
  the red "Now" line are all fixed to the current week. Navigating weeks changes nothing but a
  number.
- **Failure scenario:** User on "Week 28" taps "Previous week". The label flips to "Week 27" but
  the grid still shows this week's Jul 13-17 dates with today highlighted and the same "Now" line —
  no week actually changed.
- **Fix (L):** Make the visible week data a function of the selected `week` (recompute
  weekDays/blocks/today for the chosen ISO week and refetch), or remove the prev/next controls
  until week navigation is wired.

#### H8 — Onboarding-created projects are discarded but reported "N created" · FAKT

- **View:** Customer/User
- **Location:** `apps/mobile/src/onboarding/OnboardingFlow.tsx:49`
- **Problem:** Onboarding step 2 ("What are you working on?") lets users create projects,
  accumulating them in local `projects` state (lines 31-41), and the Done step reports "N created"
  (line 611). But `finish()` only persists the hourly rate via `createRate`; the projects are never
  sent to any API (there is no project-create endpoint in the client at all — `api/tracking.ts`
  only GETs `/api/tracking/projects`). The created projects are thrown away on `onDone()`.
- **Failure scenario:** New user carefully adds 3 projects during onboarding; the final screen
  shows "Projects — 3 created"; they land in the workspace and the Projects screen is empty. Work
  and a false confirmation both lost.
- **Fix (M):** Either persist the created projects through a real create-project call in `finish()`,
  or remove the project-creation UI / the "N created" summary so onboarding does not claim to save
  something it discards.

#### H9 — Disconnecting an integration is impossible on the web build · FAKT

- **View:** Customer/User
- **Location:** `apps/mobile/src/screens/ProfileScreen.tsx:436`
- **Problem:** Disconnecting an integration is gated behind `Alert.alert(...)`. In
  react-native-web 0.19.13 (the web render target) `Alert.alert` is a no-op empty function
  (`react-native-web/dist/exports/Alert/index.js: static alert() {}`). On web no confirmation
  dialog appears AND the `onPress` that calls `connectors.disconnect(item.id)` lives inside the
  alert button config, so it never runs. Disconnecting an integration is impossible on web.
- **Failure scenario:** On the web build, a user with a connected Google/Jira integration taps the
  row to disconnect. Nothing happens at all — no dialog, no disconnect, no feedback. The
  integration cannot be removed.
- **Fix (M):** Use a cross-platform confirm (a custom in-app modal, or branch to `window.confirm`
  on web) instead of RN `Alert`, so the confirmation and the disconnect action work on every
  platform.

### Mittel

#### M1 — arc42 doc still binds offline-first, contradicting ADR-0049 and the register · FAKT

- **View:** Requirements Engineer
- **Location:** `docs/architecture.md:159` (also `:135` Quality Goal, `:215` Solution Strategy)
- **Problem:** The arc42 doc still declares offline-first as a binding architecture constraint
  (line 159 "Offline-first is core architecture ... forces the sync engine (REQ-006) into M1"), a
  top-3 Quality Goal (line 135 "Offline-first reliability") and the core Solution Strategy (line
  215 "Offline-first local store + sync engine in the core"). ADR-0049 ("Abandon the offline-first
  architecture", Accepted) supersedes that whole line, and the register's own REQ-004
  ("client is online-only ... local offline store was removed") and REQ-006 ("Deferred by ADR-0049")
  already reflect it. The governing sections contradict an accepted ADR and the register in the
  same file.
- **Failure scenario:** An agent picks up client/sync work, reads §2/§3/§4
  (Constraints/Quality Goals/Solution Strategy) per CLAUDE.md's reading order, and builds against an
  offline-first requirement that ADR-0049 explicitly removed — exactly the rework the constraint
  table was meant to prevent.
- **Fix (S):** Update lines 135, 159 and 215 to state online-only per ADR-0049 (deterministic
  conflict engine kept dormant), mirroring the REQ-004/006 notes; move offline to the
  post-1.0/re-entry framing. *(Fixed in this PR.)*

#### M2 — REQ-015 marked "Proposed" but the grounded assistant is shipped end-to-end · FAKT

- **View:** Requirements Engineer
- **Location:** `docs/architecture.md:98`
- **Problem:** REQ-015 (AI assistant chat) is marked "Proposed", but the grounded assistant is
  implemented end-to-end: backend port + `LlmAssistant` (`apps/api/src/modules/ai/assistant.ts`),
  the guarded endpoint `POST /api/ai/assistant` with a real credit debit
  (`ai.controller.ts:46-63`), the client caller `apps/mobile/src/api/assistant.ts`
  (`askAssistant`/`factsFromReports`), and the full `AssistantScreen.tsx`. The register status
  understates delivered scope, violating CLAUDE.md's rule to keep the register current in the
  delivering PR.
- **Failure scenario:** A planner reads the register to see what is left for M2/M3, treats the
  assistant as unbuilt ("Proposed"), and either re-schedules already-shipped work or skips
  reviewing the live, credit-charging endpoint that is actually in the codebase.
- **Fix (S):** Update REQ-015 status to reflect the shipped assistant (endpoint + credit debit +
  client screen) and add its traceability note; fix the mislabeled "REQ-020" reference in
  `assistant.ts` (REQ-020 is privacy, not the assistant). *(Fixed in this PR.)*

#### M3 — Grounded assistant returns German refusal strings in an English-only UI · FAKT

- **Views:** Requirements Engineer, Software Developer
- **Location:** `apps/api/src/modules/ai/assistant.ts:109` (also `:38`)
- **Problem:** The backend grounded assistant returns German user-facing strings —
  "Das steht nicht in deinen aktuellen Daten." (line 109, AI-refusal path) and
  "Dazu habe ich gerade keine Daten." (line 38, empty-facts fallback) — while the product is
  English-only and the LLM prompt itself instructs "Answer concisely in English" (line 61). These
  are surfaced verbatim as the assistant's message (`AssistantScreen.tsx:77` renders `r.text`). The
  parallel English refusal on line 50 shows the intent was English; these two were missed.
- **Failure scenario:** A user on the live backend, with credits, asks a question the model cannot
  answer from the supplied facts; the LLM returns the NO_DATA marker and the API responds with the
  German sentence, which the Assistant screen displays to an English-only user.
- **Fix (S):** Replace both German strings with English equivalents (e.g. "That isn't in your
  current data." and "I don't have any data for that right now."), matching the English refusal
  already used at line 50 and in the client.

#### M4 — Permanent per-question idempotency key is an AI-metering hole · RISIKO

- **View:** Requirements Engineer
- **Location:** `apps/api/src/modules/ai/ai.controller.ts:58`
- **Problem:** The assistant credit debit uses a permanent per-question idempotency key
  `assistant:${workspaceId}:${sha256(question)}` (`questionKey`, line 58/67). Because `debit()` is
  idempotent on `operationId` forever, re-asking the identical question string runs the LLM again
  (real provider cost) but records no second debit — yet the handler still returns `charged:true`
  (line 60/62). Identical questions are metered exactly once for all time, and the "charged" flag
  is dishonest on every replay. This is a metering hole against ADR-0008's credit ledger and the
  "LLM cost overrun" mitigation.
- **Failure scenario:** With a real LLM provider configured, a user asks "How many hours did I
  track this week?" (debited 1 credit). The next week they submit the exact same string: the
  assistant calls the model again (billable) but `debit()` returns the prior entry with no balance
  change, and the API reports `charged:true`. Repeating the same question yields unlimited free AI
  answers.
- **Fix (M):** Scope the idempotency key to a single request attempt (a client-supplied
  request/operation id or a timestamp/nonce), not the question text, so retries of one submission
  dedupe but re-asked questions are metered; only report `charged:true` when a new ledger entry was
  actually inserted.

#### M5 — Natural-language pre-parser misreads clock times as durations · RISIKO

- **View:** Architect
- **Location:** `packages/domain/src/nlentry/parse.ts:50`
- **Problem:** `CLOCK_RE` (`/\b(\d{1,2}):(\d{2})\b/g`) interprets every H:MM token as a DURATION of
  that many hours and minutes, and it runs globally and additively over the whole phrase. It cannot
  distinguish a duration ("2:30" = 2h30m) from a clock time-of-day, and it sums multiple matches.
- **Failure scenario:** A user types "call at 9:30" → parsed as a 9h30m entry; "meeting 2:30-3:30"
  → both matches sum to a 6h entry. The draft duration is grossly wrong for very common wording. It
  is user-confirmed rather than auto-persisted, but the proposed number is silently far off and
  easy to accept.
- **Fix (M):** Only treat H:MM as a duration when it is not preceded by a time-of-day cue
  (at/um/@) and not part of a range, or require an explicit unit; otherwise ignore clock-shaped
  tokens and let the note/LLM path handle them. *(Fixed: `TIME_OF_DAY_RE` (at/um/ab/von/gegen/@)
  and `CLOCK_RANGE_RE` (a `H:MM–H:MM` window) are stripped before the duration pass; a bare
  `2:30` is still a duration.)*

#### M6 — Readiness probe ignores Redis; REDIS_URL optional in production · RISIKO

- **View:** DevOps
- **Location:** `apps/api/src/modules/health/health.controller.ts:39`
- **Problem:** The readiness probe (`/health/ready`) only pings the DB (`select 1`). Redis is the
  backing service for the global rate limiter (`app.module.ts:40-42`,
  `ThrottlerStorageRedisService`) but is never checked. Additionally `REDIS_URL` in `config.ts`
  (line 20) is optional even in production → without `REDIS_URL` the `ThrottlerGuard` silently
  falls back to per-instance in-memory counters (100 req/min becomes 100×N).
- **Failure scenario:** Redis goes offline in production (or `REDIS_URL` is forgotten at deploy):
  readiness still reports 200 "ready", the instance stays in the LB rotation, and the rate limiter
  either errors against dead Redis or degrades unnoticed to per-instance counting — the global
  100/min limit is counted per instance and is ineffective, with no alarm.
- **Fix (S):** Extend readiness with a Redis PING (503 if Redis is configured but unreachable);
  make `REDIS_URL` mandatory in the production config refine (like `AUTH_SECRET`) so the shared
  limiter is guaranteed in multi-instance operation.

#### M7 — nginx caches the API upstream IP; recreating the API container 502s · RISIKO

- **View:** DevOps
- **Location:** `apps/mobile/nginx.conf:13`
- **Problem:** `proxy_pass http://api:3000/api/;` uses a hostname literal with no `resolver`/variable
  → nginx resolves the upstream `api` once at config load and caches the IP for the worker's life.
  The `web` service also only attaches via short-form `depends_on: api` (`docker-compose.yml:59`)
  with no condition/healthcheck (and `api` has no healthcheck at all).
- **Failure scenario:** `docker compose up --force-recreate api` (or an api crash/recreate) assigns
  a new container IP. nginx keeps the old IP → all `/api` requests return 502 until the web
  container is itself restarted/reloaded. For stack disposability (containers are throwaway) a real
  break.
- **Fix (S):** Set `resolver 127.0.0.11 valid=10s;` in nginx and proxy the upstream via a variable
  (`set $upstream http://api:3000; proxy_pass $upstream/api/;`) so DNS is resolved per short-lived
  request; give `api` a healthcheck and attach `web` via `condition: service_healthy`.

#### M8 — Containers run as root (no USER directive) · RISIKO

- **View:** DevOps
- **Location:** `apps/api/Dockerfile:29` (also `apps/mobile/Dockerfile:37`)
- **Problem:** The runner image (`FROM node:22-alpine AS runner`) has no `USER` directive; the
  process runs as root. The same applies to the mobile/nginx image. So the Node API process (and
  the migration step) run with root privileges in the container.
- **Failure scenario:** An RCE/container-escape chain via an app or dependency vulnerability hits a
  root process → the attacker immediately has full rights in the container (write all app files,
  network access as root) instead of an unprivileged user. Pure hardening/supply-chain protection
  is missing.
- **Fix (S):** Use an unprivileged user in the runner stage (`USER node` for the Node image; a
  non-root/unprivileged setup for nginx) and set file ownership accordingly.

#### M9 — Concurrent clock-in surfaces as HTTP 500 instead of the documented 400 · RISIKO

- **Views:** Tester (Mittel), Security & Correctness (Niedrig)
- **Location:** `apps/api/src/modules/worktime/service.ts:95`
- **Problem:** `clockIn()` guards the one-open-shift invariant with a `getRunningShift()`
  read-then-insert and documents that a second clock-in is rejected "with a clear error rather than
  let the constraint surface as a 500". But that clear `ValidationError` is only produced on the
  sequential path; the DB partial unique index `attendance_shifts_one_open_per_ws` is what actually
  protects a concurrent race, and the raw `unique_violation` (Postgres 23505) it throws is not
  caught/translated, so it surfaces through `ProblemDetailsFilter` as a 500. The only test
  (`punch-clock.integration.test.ts:66`) covers just the sequential case. (`startTimer` avoids this
  by wrapping stop+start in one transaction; `clockIn` does not.)
- **Failure scenario:** A user double-taps clock-in (or two devices clock in at once). Both requests
  pass `getRunningShift()==null`, both INSERT an open shift; the index blocks the second, which
  returns HTTP 500 instead of the promised 400 "already clocked in". Data integrity holds, but the
  contract/error mapping is wrong and unverified.
- **Fix (S):** Catch the `unique_violation` on the open-shift index in `clockIn()` and map it to the
  same `ValidationError('already clocked in')` (or use `ON CONFLICT DO NOTHING` and translate the
  no-op). Add a concurrency test asserting exactly one open shift and a 4xx (not 500) for the loser.
  *(Fixed: `clockIn` catches SQLSTATE 23505 and throws `ValidationError`; a concurrency integration
  test asserts one open shift + a `ValidationError` (not a raw 500) for the loser.)*

#### M10 — Fabricated subscription plan/renewal shown as fact · FAKT / RISIKO

- **Views:** UX Designer, Customer/User
- **Location:** `apps/mobile/src/screens/SettingsScreen.tsx:214`
- **Problem:** The Subscription card hardcodes a "Current plan" row with subtitle "Renews Aug 1"
  (line 214) and a static `Pro` badge, with no billing/entitlement data behind it (no billing hook
  imported; `CreditsScreen.tsx:58` likewise hardcodes a "Pro" badge, and `useCredits` returns no
  tier field). The adjacent "Manage subscription" is honestly gated with a "Coming soon" badge.
  Every user sees the same invented renewal date and tier — fabricated subscription state,
  violating the no-mock-data / entitlement-source rules.
- **Failure scenario:** A free-tier (or unsubscribed) user opens Settings → Subscription and reads
  "Current plan · Renews Aug 1 · Pro" — a concrete date and tier that are pure literals, not their
  real entitlement.
- **Fix (S):** Source plan name and renewal date from the billing/entitlement API, or mark the row
  "Coming soon" like "Manage subscription" until it is wired; do not hardcode Pro/renewal.

#### M11 — Onboarding "already onboarded" flag is not durable on native · RISIKO

- **View:** Customer/User
- **Location:** `apps/mobile/src/onboarding/onboardingStore.ts:24`
- **Problem:** The "already onboarded" flag persists via `localStorage` on web but falls back to a
  module-level in-memory `memoryFlag` on native (iOS/Android), which resets to false on every cold
  start. `hasOnboarded()` returns that false, so the full 5-step onboarding flow is shown again on
  every app launch on the primary mobile platforms. (The file comment flags it as an intentional
  interim seam pending AsyncStorage/server flag; native is not the current render target.)
- **Failure scenario:** An iOS/Android user completes onboarding, force-quits the app, reopens it —
  and is dropped back into the Welcome/onboarding flow again, every single launch.
- **Fix (M):** Wire a durable native store (AsyncStorage / a server-side onboarded flag) behind
  `hasOnboarded`/`markOnboarded` so the flag survives app restarts on native.

#### M12 — Deleting an hourly rate is one tap, no confirm, no undo · RISIKO

- **View:** Customer/User
- **Location:** `apps/mobile/src/screens/RatesScreen.tsx:233`
- **Problem:** Deleting an hourly rate is a single tap on a small "x" `IconButton` that calls
  `removeRate(r.id)` → `rates.remove(id)` (DELETE) immediately, with no confirmation dialog and no
  undo. Rates drive money/invoice computation, so this is a destructive, money-affecting action a
  mis-tap triggers irreversibly — inconsistent with the app's own convention (disconnect-integration
  is confirmed; ProjectsScreen offers Undo).
- **Failure scenario:** A user means to tap an adjacent row on a phone, hits the "x" on their
  workspace default rate; it is deleted instantly with no confirm and no undo, and subsequent
  pricing falls back/breaks until they remember and re-enter it.
- **Fix (S):** Require a confirmation (or provide an undo affordance) before deleting a rate, given
  its irreversible effect on billing figures.

#### M13 — Year-straddling absences are double-counted in the vacation balance · RISIKO

- **View:** Security & Correctness
- **Location:** `apps/api/src/modules/absences/service.ts:151`
- **Problem:** `balanceForYear` selects absences overlapping [Jan 1 .. Dec 31] of the year via
  `listAbsences`, then sums `absenceDays` over each row. `absenceDays`
  (`packages/domain/src/absences/absence.ts:38`) counts the ENTIRE inclusive range, not the portion
  inside the queried year. A vacation that straddles a year boundary is therefore counted at its
  full length in BOTH years, inflating `usedDays` and understating `remainingDays` — a wrong number
  that reaches a timesheet (violates the deterministic-core intent, ADR-0005).
- **Failure scenario:** Policy = 30 days. A single vacation spans 2025-12-29..2026-01-04 (7
  inclusive days, only 4 in 2026). `GET /api/absences/balance?year=2026` reports `usedDays=7`
  (should be 4) and `remainingDays=23` (should be 26); `?year=2025` also charges the full 7.
- **Fix (M):** Clip the counted days to the intersection of the absence range with the queried year
  before summing (effective start = `max(range.start, Jan 1)`, end = `min(range.end, Dec 31)`), or
  count per-day membership against the year.

### Niedrig

#### N1 — Connector consent-UI capability labels are German · RISIKO

- **View:** Requirements Engineer
- **Location:** `apps/api/src/modules/connectors/registry.ts:42`
- **Problem:** The connector capability labels — explicitly documented (line ~17) as "Human label
  for the consent UI" — are all German: "Issues & Commits lesen" / "Issues erstellen" (42,43,52,53),
  "Tickets lesen" / "Tickets & Worklogs schreiben" (62,63), "Kontext lesen" /
  "Zusammenfassungen posten" (82,83), "Google Kalender" / "Termine lesen" /
  "Termine als Capture-Kandidaten" (88,94,97). `GET /api/connectors` returns these strings for a
  consent/scopes UI, contradicting the English-only-UI rule (ADR-0033 consent-first connector
  scopes).
- **Failure scenario:** Once the consent UI renders per-capability labels (the DTO already carries
  `capabilities`), an English-only user granting a GitHub/Jira/Slack/Calendar scope is shown German
  consent text describing exactly what they are authorizing.
- **Fix (S):** Translate all capability labels in `registry.ts` to English (or route them through
  the i18n layer) before the connector consent UI ships.

#### N2 — Runtime View promises a diagram per fulfilled requirement but has one · FAKT

- **View:** Requirements Engineer
- **Location:** `docs/architecture.md:264` (also `:80`)
- **Problem:** The Runtime View states "Each fulfilled requirement gets a scenario here (a Mermaid
  sequence diagram) linking back to its REQ-NNN" (line 264), and §1.1 promises "Each fulfilled
  requirement gains a Runtime-View sequence diagram" (line 80). The section contains exactly one
  `sequenceDiagram` (REQ-004), while the register lists ~12 requirements as Done. The document's own
  stated traceability rule is unmet for every fulfilled requirement except one.
- **Failure scenario:** A reviewer using the Runtime View as the promised behavioral-traceability
  index for a Done requirement (e.g. REQ-027 credit debit or REQ-030 signable report) finds no
  diagram, so the doc cannot serve the audit/traceability purpose it asserts.
- **Fix (M):** Either add the missing Runtime-View scenarios for the Done requirements, or amend
  lines 80/264 to scope the rule to selected invariant-critical flows and note the intentional
  subset. *(Softened the wording in this PR; the register status column is the authoritative
  per-requirement traceability record.)*

#### N3 — Invoice export uses the German literal "Projekt" as a fallback name · FAKT

- **Views:** Architect, Software Developer
- **Location:** `apps/api/src/modules/billing/invoice-service.ts:329`
- **Problem:** `getInvoiceExport()` hard-codes the German word "Projekt" as the fallback project
  name (`nameByProject.get(l.projectId) ?? 'Projekt'`). This is in the data-assembly layer, so it
  bypasses the proper EN/DE localisation tables the PDF/CSV templates use and violates the
  English-only-UI rule regardless of chosen locale. `nameByProject` is built only from non-deleted
  projects (line 286), yet a domain invoice line is still emitted for a project missing from the
  map.
- **Failure scenario:** A billable entry's project was soft-deleted (or is otherwise missing from
  the live projects join). Its invoice line renders with `projectName` "Projekt" — a German string
  printed on an English invoice PDF/CSV shown to a client.
- **Fix (S):** Use an English fallback ("Project") and, ideally, thread the same `ExportLocale` used
  by the templates so the fallback is localised consistently.

#### N4 — Same accent option labeled differently in Settings vs Profile · FAKT

- **View:** UX Designer
- **Location:** `apps/mobile/src/screens/SettingsScreen.tsx:96`
- **Problem:** The same accent option is labeled inconsistently across the two Appearance surfaces.
  Settings labels key `blueprint` as "Blueprint" (line 96), while Profile's Appearance card labels
  the identical `blueprint` key as "Royal Blue" (`ProfileScreen.tsx:64`). Both drive the same
  `useAccent`, so one selection shows under two different names depending on which screen the user
  is on.
- **Failure scenario:** User picks the first accent in Profile → Appearance where it reads
  "Royal Blue". Opening Settings → Appearance, the currently-selected accent is now labeled
  "Blueprint", implying a different theme.
- **Fix (S):** Use one shared label source for accent options (e.g. export the `ACCENT_OPTIONS`
  list) so Settings and Profile render the same name.

#### N5 — Reopening an entry with `endedAt:null` while a timer runs 500s · FAKT

- **View:** Security & Correctness
- **Location:** `apps/api/src/modules/tracking/entries-service.ts:211`
- **Problem:** `updateEntry` accepts `endedAt:null` (`UpdateEntryDto` uses `wireDate.nullish()`) and
  issues an UPDATE setting `ended_at=null`. When another live timer already exists in the workspace,
  this creates a second row with `ended_at IS NULL`, violating the partial unique index
  `time_entries_one_running_per_ws`. Unlike `startTimer`, `updateEntry` does not stop the existing
  timer, so the DB unique violation propagates as an unhandled error mapped to a generic 500 by
  `ProblemDetailsFilter` instead of a clean 4xx (409). A single normal request triggers it — no
  concurrency needed.
- **Failure scenario:** Workspace has a running timer (entry A, `ended_at` null). Client sends
  `PATCH /api/tracking/entries/{B}` with `{"endedAt": null}` for a completed entry B. `isValidEntry`
  passes (null end is valid); the UPDATE hits the unique index → Postgres error → 500 Internal
  Server Error.
- **Fix (S):** Reject reopening an entry when a timer is already running (return 409/validation
  error), or stop the existing timer the way `startTimer` does; at minimum translate the
  unique-violation into a 409 problem+json.

## What I'd fix first

Ordered by blast radius, then severity, then fix cost:

1. **B1 — `POST /api/billing/credits/grant` self-mint** (`billing.controller.ts:248`). Trivial to
   remove, and it collapses the entire credit-monetization gate; ship first.
2. **B2 — `POST /api/billing/entitlement/events` self-grant Pro** (`billing.controller.ts:312`).
   Same class of monetization bypass; remove the session-reachable seam.
3. **B3 — Non-atomic workspace provisioning** (`workspace.ts:17`). Silent, permanent data
   fragmentation for brand-new accounts on first load — the worst *correctness* blast radius.
4. **H2 — Credit debit overdraw race** (`credits-service.ts:148`). Concurrency hole on the same
   monetization boundary; serialize per workspace and add the missing concurrency test.
5. **H1 — `startTimer` negative-duration entry** (`entries-service.ts:66`). One backdated start
   500s the entire billing/export surface for the workspace — cheap (S) to guard.
6. **H3 — Migrations on every replica boot** (`Dockerfile:38`). Blocks any multi-replica/rolling
   deploy the first time a migration is pending; must be fixed before horizontal scale.
7. **H8 / H4 — Onboarding projects & Today hero note silently discarded**
   (`OnboardingFlow.tsx:49`, `TodayScreen.tsx:127`). Direct data loss with false confirmation on
   the two most prominent capture surfaces.
8. **H9 — Web disconnect is a dead button** (`ProfileScreen.tsx:436`). A whole action is
   non-functional on the primary (web) render target.
9. **M4 — Permanent per-question AI idempotency key** (`ai.controller.ts:58`) and **M13 —
   year-straddling absence double-count** (`absences/service.ts:151`). Both are deterministic-core
   correctness/metering errors that quietly produce wrong numbers.
10. **The doc-truth trio** — **M1** (offline-first still bound), **M2** (REQ-015 stale), **N2**
    (Runtime-View promise). Fixed in this PR: the register/constraints/quality-goals/solution-strategy
    now match ADR-0049 and the shipped assistant, and the diagram promise is scoped to
    invariant-critical flows.
11. The remaining Mittel/Niedrig items (German UI leaks H5/M3/N1/N3, fabricated Planner/Subscription
    UI H6/H7/M10, container hardening M6/M7/M8, NL clock parsing M5, error-mapping M9/N5, native
    onboarding persistence M11, rate-delete confirm M12, accent label N4) as follow-up issues.
