# ADR 0042: Offline Money Path Computed by the Deterministic Core

## Status

Accepted (owner decision) — **realizes [ADR-0040](0040-offline-first-local-store-as-sync-client.md)**
(offline store = ADR-0019 client) and is bound by
[ADR-0005](0005-deterministic-core-llm-assist.md) (deterministic core). Delivered as a slice of the
offline epic #174 (#176).

## Context

ADR-0040 rule 2 is categorical: the local store is a **thin repository** and **every** offline figure
comes from the *same* `packages/domain` functions the API uses — a client never recomputes a number in
SQL and never hardcodes a rate or target. The offline Reports screen was the last place still short of
that bar: with no API it fell back to **fabricated** demo figures (a €4,860 billable total, hardcoded
budget ratios) — exactly the "parallel world" ADR-0040 rejected in PR #172.

Two things were missing to close it:

1. The local schema mirrored `clients`/`projects`/`tasks`/`time_entries`/`shifts`/`absences`/
   `credit_entries`/`preferences`, but **not** the server's `rates` and `budgets` tables — so there
   was nothing to price billable time or fill a budget ring against offline.
2. The money math existed only inside the server's `billing` service (`billingSummary`,
   `projectCost`, `consumedFor`), entangled with Drizzle rows. The correctness-sensitive step —
   selecting the rate rules applicable to an entry's client/project/task chain, then resolving by
   specificity and effective date — lived inline there, with no pure, reusable home.

## Decision

1. **Mirror `rates` and `budgets` into the local schema** (same column names, carrying the ADR-0040
   sync/tenancy columns `workspace_id`/`version`/`updated_at`/`deleted_at`/`device_id`/`operation_id`).
   They are thin repositories like every other local table — rows in/out, no math. Turning sync on
   reconciles them through the ADR-0019 engine unchanged; there is no schema fork.

2. **Extract the entry-pricing rule into the core.** `packages/domain/budgets/pricing.ts`
   (`applicableRules` + `rateForEntry`) is the single definition of "which rate prices this entry,"
   and both the server `billing` service and the offline client now call it — one precedence rule,
   not two. `packages/domain/reporting/finance.ts` (`priceBillableEntries`, `budgetConsumptions`)
   composes it with the existing `summarizeEntries`, `costOf`, and `budgetStatus` into the Reports
   money read model. All of it is pure and unit-tested.

3. **Offline Reports reads local rows and calls the core.** The client hook is the impure edge (rows
   + the clock in); the arithmetic is the core's. Offline == online by construction: identical
   entries, rates, and budgets yield identical numbers whether the figure is computed on the server or
   on the device.

A standalone store seeds a workspace-default rate and two project budgets on first launch, so the
figures are **real from tracked time** (starting at zero, growing as the user tracks) rather than
fabricated. Overtime needs recorded shifts; there is no offline punch-clock yet, so it is honestly `0`
offline until that path lands (tracked separately) — an honest zero, never a fabricated one.

## Consequences

- Offline Reports shows the user's **own** billable money and budget consumption, computed by the same
  calculator as the server — the ADR-0040 "no parallel world / no fabricated numbers" bar is now met
  for the money path too.
- The rate-precedence rule has one tested definition; the server `billing` service was refactored onto
  it, removing the duplicated inline filter (its integration tests guard the behaviour).
- The local schema now carries `rates`/`budgets`; because they mirror the server and carry the sync
  columns, no on-device migration is owed when team sync arrives.
- Overtime and any client-level budget roll-up remain honest zeros offline until their inputs exist
  locally — surfaced as such, not faked.

## Alternatives considered

- **Compute the offline money in the client hook (or in SQL):** rejected — duplicates the calculator
  and reintroduces the exact ADR-0005/0040 drift this slice removes.
- **Leave offline Reports on demo figures:** rejected — fabricated money on a product whose thesis is
  trustworthy numbers is precisely the failure mode ADR-0040 was written against.
- **Skip seeding a rate/budgets (show empty tiles offline):** rejected — a standalone user would see
  zeros with no way to reach a non-zero without a rates/budgets editor (that editor is future work);
  a seeded default gives real, honest figures now.
