# ADR 0054: Design system v7 — invoice PDF + design-adherence gate

## Status

Accepted (owner decision) — extends the invoicing money layer
([ADR-0051](0051-invoicing-abrechnung.md), REQ-005/009) and the deterministic-core
rule ([ADR-0005](0005-deterministic-core-llm-assist.md)); complements the mobile testing
strategy ([ADR-0027](0027-mobile-ui-testing-strategy.md)).

## Context

The design-system **v7** handoff (`docs/design-system/`) changed **no** tokens,
components, or screens — every one is byte-identical to v6. What it adds is:

- an A4 **"Rechnung"** (invoice) document template — a polished, print-ready
  invoice in the DevTime look;
- a pitch-deck template + tool metadata (`_ds_manifest.json`, `_ds_bundle.js`);
- an **adherence lint config** (`_adherence.oxlintrc.json`) that forbids raw hex
  colours / raw `px` / off-system fonts and requires importing components from the
  package index — rules the design tool checks against its own web JSX prototypes.

Two of these are actionable in the product; one is a reference refresh.

### Forces

- **Invoice PDF.** The invoice export endpoint only emitted CSV. The v7 invoice
  design is exactly the missing PDF. But the template also mocks up a freelancer's
  postal address, bank details, tax numbers, and an optional 19 % VAT row — none of
  which exist in the invoice/workspace model. Rendering the *look* is right;
  fabricating those *figures* would violate ADR-0005 (a number on an invoice that
  no deterministic core produced).
- **Adherence lint.** The oxlint config is written for web JSX with inline
  `style="…#hex…px…"`. Our client is React Native: StyleSheet uses unitless
  numbers (so the `px` rule is meaningless), and fonts/colours already flow through
  the `@mydevtime/design` theme. Only the **"colours come from the theme, not raw
  hex"** rule transfers. The app already has ~two dozen legacy raw-hex uses; a
  blind big-bang refactor is risky to do without a visual check.

## Decision

**1. Invoice PDF in the v7 look.** A new `invoice-pdf.ts` — the sole PDFKit adapter
for invoices, vendor type confined — renders the **frozen** `InvoiceExport`
(`getInvoiceExport`) as the warm DevTime "Rechnung": paper `#fffcf8`, orange accent
rule, positions grouped one-per-project (the template's default collective view),
and a dark grand-total block whose figure is the invoice's stored `totalMinor`,
never recomputed (ADR-0005). The endpoint gains `?format=pdf|csv` (default `csv`).
`getInvoiceExport` now also carries `senderName` (the workspace = issuer). We render
**only data we hold** — the template's invented address/bank/tax lines and the VAT
row are omitted; a real issuer profile + tax config is tracked as follow-up.

**2. Design-adherence gate as a ratchet.** `scripts/check-design-adherence.mjs`
(wired into `./test.sh`) enforces the one transferable rule — no raw hex colours in
`apps/mobile/src`. Because the codebase already has legacy uses, it is a **ratchet**,
not a big bang: `design-adherence-baseline.json` records today's per-file counts and
the gate fails only when a file introduces *more* raw hex than its baseline. New
drift is blocked; the baseline is burn-down debt to lower as hexes become theme
tokens. The `px` / font / import-from-index rules are recorded here as **not
applicable** to the RN client and are intentionally not ported.

**3. Reference refresh.** `docs/design-system/` is updated to v7 verbatim (the new
templates, tool metadata, and adherence config), matching the prior "import design
system vN" reference commits.

## Consequences

- **Pros**: an owner can now export a client-ready invoice PDF that matches the
  design; design drift (hardcoded colours) can no longer *grow* unnoticed; the
  checked-in reference is current.
- **Cons / limits**: the invoice PDF uses PDFKit's standard fonts (Helvetica /
  Courier for tabular figures), not the Clash/JetBrains faces — embedding the woff2
  faces is out of scope, as in the timesheet PDF. It carries no issuer address / VAT
  until those are modelled. The adherence gate covers only colours (the RN-relevant
  rule) and leaves ~two dozen baselined uses as debt.
- **Reversible**: the invoice PDF is one adapter + one query param; the adherence
  gate is one script + a baseline JSON + one `test.sh` line. Removing them restores
  the prior behaviour with no effect on the rest of the app.
