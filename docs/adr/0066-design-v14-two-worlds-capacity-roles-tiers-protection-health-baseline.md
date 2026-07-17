# ADR 0066: Design v14 — two worlds, capacity honesty, roles & tiers, protection flag, health baseline

## Status

Accepted (owner decision) — **extends ADR-0063** (calendar-centric IA), ADR-0064
(auto-tracker reality layer) and ADR-0065 (design v13). Bound by ADR-0005 (deterministic
core; AI proposes, the user books), ADR-0010 (work-time), ADR-0027 (entitlements/credits,
not payment SDKs) and the consent-first capture rule (REQ-025). Realizes the v14 design
handoff (§F two worlds + capacity honesty, §R roles & tiers, §H health & balance, D14
protection flag, §M simplification pass).

## Context

The v14 handoff is a large step: it positions myDevTime as a **personal planner for work,
life and health** rather than a pure time tracker, and adds several cross-cutting concerns
that touch the planner, reports, billing visibility and the entitlement model. As with v13,
every capability must land **without mock data**, in **English**, and **anything not yet
backed by the backend must be captured as a requirement with acceptance tests** rather than
faked. The non-negotiables stand: deterministic numbers in `packages/domain`; the LLM only
proposes/phrases with provenance and credits; workspace isolation; consent-first capture;
health signals are never a diagnosis and never paywalled.

The new pillars, and why each needs a decision:

- **§F Ein Kalender, zwei Welten** — one person, **one** timeline. Work and life live in the
  same planner (parallel apps — Cozi beside Toggl — are the architecture error we fix). A new
  `life` entry type carries a dedicated sage token `--life` (family is not a project, so it
  never borrows a project color). The load-bearing rule is **capacity honesty**: the week you
  can truly work is the contracted target **minus your own life/protected commitments**
  ("KW32 nur 24h"), and Fill-week, the overbooking warning and the KI2 quote calculator must
  all plan against *that* number. Partner sharing (Stufe 1–3) is deliberately minimal: exactly
  one person, no family workspace, and only **Free/Busy/🛡** is ever shared — never titles or
  details.
- **§R Rollen & Tiers** — role is a **visibility preset over the existing modules, never a
  fork**. Stempler (Free) never sees €/clients/billing; Freelancer (Pro) is the superset incl.
  all AI features (token cost sits behind Pro); +Family is an orthogonal add-on. Health/Balance
  is in **all** tiers — never paywalled (paywalling health is brand-damaging). Violet becomes
  the visual Pro signal.
- **§H Health & Balance** — a Balance row in Reports (Work / Protected / Free stacked over
  waking hours, compared to a **baseline**); 📎 attachments on any entry (generalising travel
  receipts) that surface in billing/export; and two binding privacy principles: the
  **baseline principle** (all health signals calibrate to the person's own >4-week average and
  spread — **never fixed thresholds**; ">45h = red" is paternalistic) and **Slack/comm
  metadata** which, if opted into, reads only **WHEN** activity happens, never **WHAT** — not
  even "anonymised".
- **D14 Schutz-Flag „🛡 Geschützt"** — a **flag on existing entries**, not a new type and not a
  focus-mode system. It silences the user's own nudges, reports "Busy" to Outlook, and then
  shows exactly **one** digest of what was held ("Während Family: 2 Anfragen, 1 Reminder") —
  nothing is lost. It governs **communication only, never time-tracking**: timer/punch clock
  keep running; at a protected block's start while punched in, the Island asks **once**
  ("Family beginnt — ausstempeln?") and **never auto-punches-out** (the punch clock is a legal
  record; the human decides).
- **§M Vereinfachungs-Pass** — travel is **one type** (direction is from/to, no round-trip
  semantics); the planner shows **at most one** contextual banner (priority
  Conflict > Price-of-week > Yesterday-healing > Note); the Island carries **only** timer +
  punch (travel starts via Smart-Add / ⌘K); and the four banner variants become **one**
  `ContextBanner` component with a `variant` prop.

## Decision

Deliver v14 as a sequence of focused changes, deterministic cores first, exactly as v13 was.
This ADR records the decisions; each slice keeps the Requirements Register and this traceability
current in its own PR.

### §F Capacity honesty — the deterministic core (this slice, REQ-055)

`packages/domain/src/capacity/plannable.ts` is pure and framework-free (ADR-0005):

- `Commitment` = a `life` or `protected` block as a minute-of-day interval; `CapacityDay` = a
  day's contracted `targetMs` plus its commitments.
- `committedMinutes` merges overlapping/adjacent commitments so double-booked life time is
  **never subtracted twice**; zero-length and inverted intervals are dropped.
- `dayCapacity` = `max(0, targetMs − committed)`; `weekCapacity` aggregates; `overbookedMs`
  measures a planned amount of work against the **true** plannable capacity.
- The sage `--life` token is added to the palette (theme-independent like `--live`/`--ai`,
  distinct from `good`, AA-Large as text on surface in all six accent × mode combos).

The `life` type never reaches money math on its own — it only reduces plannable capacity; it
is not billable and carries no rate.

### Deferred, with acceptance criteria (follow-up slices)

Anything below is **not yet backend-backed**; it is a requirement now and ships with an
acceptance-tier test when built:

1. **`life` entry type persistence** — the `life` source on a time entry, workspace-isolated,
   never billable. *Acceptance:* an integration test creating a `life` entry and asserting it
   is excluded from billable/revenue rollups and included in capacity reduction.
2. **Partner Free/Busy/🛡 share (§F Stufe 1–3)** — exactly one partner; a share exposes only
   Free/Busy/🛡, never titles; partner requests arrive as `req` blocks that acceptance makes
   firm. *Acceptance:* an integration test asserting a shared view contains no entry titles and
   that a declined/pending request is not booked.
3. **Capacity-aware planner (§F Stufe 2)** — the Planner head-trace shows plannable = target −
   life/protected, and Fill-week / overbooking / KI2 read `weekCapacity().plannableMs`.
   *Acceptance:* a Fill-week test that refuses to place work past the true plannable capacity.
4. **§R roles & tiers** — a deterministic visibility resolver (role → visible modules) with the
   Stempler/Freelancer/+Family matrix; Health/Balance always visible. *Acceptance:* a resolver
   test asserting Stempler never exposes €/clients/billing and Health is visible in every tier.
5. **D14 protection flag** — a digest aggregator (held nudges/requests during protected blocks)
   and the Island transition prompt; communication-only, never auto-punch-out. *Acceptance:* a
   core test that a protected block mutes nudges and produces exactly one digest, and that the
   punch clock is untouched.
6. **§H health & balance** — the baseline calculator (personal >4-week average + spread, no
   fixed thresholds) and the opt-in Slack WHEN-only signal. *Acceptance:* a baseline test that
   the same absolute hours read differently against two different personal baselines, and that
   the Slack adapter surface exposes only timing, never content.

## Consequences

- **Positive:** capacity honesty becomes a single deterministic source the planner, overbooking
  and quoting all share; life/work unify on one timeline without a second app; the role model is
  a visibility switch (no forks); health stays un-paywalled and non-judgemental by construction;
  the simplification pass removes accreted controls.
- **Negative / risks:** the `life` type and partner share touch persistence and isolation — each
  is gated behind an acceptance test before it ships. The baseline principle forbids the easy
  fixed-threshold implementation; it costs more math but is the brand-defining choice.
- **Neutral:** `--life` is one more theme-independent token; it does not affect the accent axis.

## Alternatives considered

- **A family workspace with child accounts (Cozi-style).** Rejected: §F is deliberately one
  person, one timeline; children are entries, not accounts. A shared workspace would reintroduce
  the parallel-app split we are removing and expand the sharing surface far past Free/Busy.
- **Fixed health thresholds (">45h = red").** Rejected as paternalistic and wrong across people;
  the baseline principle (relative to the person's own norm) is binding instead.
- **A protection *mode* / focus-system with its own DND schedules and exception lists.** Rejected:
  D14 is a flag on existing entries that governs communication only; OS-level DND already owns
  schedules and exceptions.
- **Auto-punch-out at a protected block.** Rejected: the punch clock is a legal record; the
  Island asks once and the human decides.
