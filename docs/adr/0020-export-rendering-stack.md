# ADR 0020: Timesheet Export / Rendering Stack — hand-rolled CSV, ExcelJS, PDFKit

## Status

Accepted

## Context

REQ-009 (#14) turns tracked time into billable documents in three formats — **CSV,
XLSX and PDF** (XLSX added by ADR-0010; the signable work-time report #38 reuses
this infrastructure). The forces:

- **One source of truth for numbers (ADR-0005):** every exported figure comes from
  the deterministic `buildTimesheet` (#14 Phase A). Serializers only *format* — they
  never re-compute a total, so the acceptance cross-check "CSV total == XLSX total
  == PDF total == domain aggregate" holds by construction.
- **Ports & adapters for volatile vendors (skill §2.2):** a rendering library is a
  vendor surface. Each lives behind one narrow serializer function; the vendor type
  never leaks past its adapter file.
- **Server-side generation** so all platforms emit byte-identical documents (web
  download + mobile share-sheet target the same endpoint).
- **Testability:** CSV must be byte-stable (golden files); XLSX cells and PDF text
  must be extractable to assert totals/rounding/rate application.
- **Solo-sustained:** prefer mature, pure-JS, widely-used libraries over heavy
  native toolchains.

## Decision

- **CSV: hand-rolled**, no dependency. RFC 4180 quoting in a small pure function —
  fully deterministic and byte-stable, trivially golden-file tested. A library would
  add surface for a format we can emit correctly in a few lines.
- **XLSX: [ExcelJS](https://github.com/exceljs/exceljs)** — pure JS, typed cells
  (durations/amounts as real numbers, not strings), styling for the header/total
  rows. Confined to one adapter; tests read the workbook back to assert cells.
- **PDF: [PDFKit](https://github.com/foliojs/pdfkit)** — mature programmatic layout
  (text flow, tables, the sender/client/period/itemized/total structure a client can
  be billed with). Deterministic output by pinning the document's creation date to
  the report period rather than the wall clock. Text is extracted in tests
  (`pdf-parse`, dev-only) to assert the numbers. *(Lands in #14 Phase C.)*
- **Localization:** de/en number and date formats via `Intl` (already the tracking
  core's dependency-free tool), selected per request — not a new i18n framework.
- **Placement:** the serializers live in the `billing` module (invoice-ready output
  is billing-grade, ADR-0006) over the `buildTimesheet` result; no new top-level
  module.

## Alternatives considered

- **Headless Chromium (Puppeteer) → HTML/CSS → PDF:** the richest layout, and
  Chromium is even preinstalled in CI. Rejected as the default: a browser per export
  is heavy for a solo backend, its PDF bytes are non-deterministic, and it is a large
  operational surface for a one-page invoice. Reconsider only if invoice design
  outgrows PDFKit's primitives.
- **SheetJS (`xlsx`) for XLSX:** capable, but the community build's typing and
  styling ergonomics are weaker than ExcelJS for authoring; ExcelJS fits the
  "typed cells + styled totals" need better.
- **A reporting/BI service:** far past a per-workspace timesheet; not warranted.
- **`pdf-lib` for PDF:** pure and deterministic, but low-level (no text flow/table
  layout) — more hand-built layout code than PDFKit for the same result.

## Consequences

- Two production dependencies enter the tree (`exceljs`, `pdfkit`) plus one dev-only
  (`pdf-parse`); each is confined behind a serializer adapter, so a future swap
  touches one file. The security-audit job now watches them.
- The `billing` module gains export endpoints returning `text/csv`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, and
  `application/pdf` with a `Content-Disposition` filename.
- Golden-file + round-trip tests pin the output; the cross-format total-equality
  test guards the "numbers trace to the core" rule.
- This ADR realizes REQ-009's rendering layer; it does not supersede any prior ADR.
