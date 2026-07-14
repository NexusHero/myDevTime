# ADR 0051: Invoicing / "Abrechnung" over billable entries

## Status

Accepted (owner decision) — realizes the design-v6 freelancer billing flow
(`docs/design-system/`, `DESIGN_BACKLOG.md` §B4). Extends the money layer
([ADR-0015](0015-backend-framework-and-persistence.md) persistence,
REQ-005/009) and is bound by [ADR-0005](0005-deterministic-core-llm-assist.md):
every invoiced amount is computed by the pure core, never an LLM.

## Context

The app tracked billable time and could export a timesheet (REQ-009), but had no
concept of **invoicing**: turning a client's tracked, billable hours in a period
into a frozen bill and marking that work as billed so it is not billed again.
Design v6 makes this the freelancer centrepiece — a client→project hierarchy
(already in the catalog), an "Abrechnung erstellen" drawer with selectable
positions and a live h/€ total, and a client-level "open" figure on Projects.

The forces: the invoice total must match the Reports/dashboard money exactly
(same rate precedence), issuing must be atomic (no half-billed hours), and it
must be impossible to bill foreign, non-billable, or already-invoiced time.

## Decision

1. **Deterministic core** (`packages/domain/invoicing`): `invoiceLines` prices
   each completed, billable, project-assigned entry in a window via the existing
   `rateForEntry` → `costOf` money math (so an invoice and the dashboard never
   disagree); `summarizeInvoice` rolls a **user-selected subset** into a draft
   total. Unpriced entries are listed at `0`, not dropped. Pure, ≥90% covered.

2. **Persistence**: a new `invoices` table (client, period, **frozen** totals,
   currency) plus `invoice_id` / `invoiced_at` markers on `time_entries`
   (migration 0017). A billed entry leaves the "open" pool; voiding an invoice
   just clears the markers and the hours return.

3. **Server-authoritative service** (billing module): `preview` (compute, persist
   nothing), `issue` (recompute eligible lines server-side, intersect with the
   client's selection, freeze totals + stamp entries **in one transaction**),
   `void` (undo), `list`, and `open-billable-per-client` (the Projects header
   figures). Every query is workspace-scoped (ADR-0015). Endpoints under
   `/api/billing/invoices` + `/api/billing/clients/open`, behind `AuthGuard`.

4. **No new entity for the billable toggle**: the v6 € toggle just flips an
   entry's existing `billable` via `PATCH /api/tracking/entries/:id`.

## Consequences

- **Pros**: real freelancer billing on top of the existing catalog + rates, with
  the same trustworthy numbers; atomic, reversible, workspace-isolated; the PDF/CSV
  export reuses the timesheet serializers (REQ-009).
- **Cons / limits**: the `invoice_id` marker carries **no hard FK** (it would form
  a schema cycle catalog→invoices→catalog) — integrity is enforced by the
  workspace-scoped service, consistent with the polymorphic `rates.scope_id`. A
  per-invoice PDF renderer (as opposed to the range-based timesheet export) and a
  client billing-type field (retainer / fixed / T&M, to drive the "— (Festpreis)"
  display) are follow-ups. Invoice numbering/sequences are not modelled yet.
- **Determinism preserved (ADR-0005)**: issuing recomputes server-side and never
  trusts a client-supplied total.
