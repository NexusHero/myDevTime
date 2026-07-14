# ADR 0055: Embed the design faces in the invoice PDF

## Status

Accepted (owner decision) — **amends** [ADR-0054](0054-design-system-v7-invoice-pdf-and-adherence-gate.md),
whose Consequences said the invoice PDF "uses PDFKit's standard fonts
(Helvetica / Courier)… embedding the woff2 faces is out of scope."

## Context

ADR-0054 shipped the invoice PDF in the v7 "Rechnung" layout but with PDFKit's
built-in Helvetica/Courier, deferring the real typography. The owner asked to use
the actual design faces. The design system ships them as `.woff2`
(`docs/design-system/fonts/`): Clash Display (display), Inter (body), JetBrains
Mono (figures — "numbers are the product").

Two frictions: PDFKit/fontkit embeds **static TrueType** reliably but its bundled
woff2 decoder fails on the **variable** Inter/JetBrains `.woff2`; and `tsc` does not
copy non-TS assets into `dist`, so fonts must be shipped into the image explicitly.

## Decision

Embed the design faces in `invoice-pdf.ts`:

- **Clash Display Bold** → wordmark + "Rechnung" title; **Clash Display Semibold** →
  bold UI labels (avoids faux-bold, which the design forbids); **Inter** → body/muted
  text; **JetBrains Mono** → every figure. `getInvoiceExport`'s frozen numbers are
  unchanged — this is presentation only (ADR-0005 holds).
- Ship the faces as **`.ttf`** decoded from the licensed `.woff2` (woff2→ttf only, no
  other change): Clash Display (ITF Free Font License), Inter + JetBrains Mono
  (SIL OFL). They live in `apps/api/src/modules/billing/export/fonts/` with a
  `README.md` recording each face's role + license.
- **Ship them into the image** the same way as DB migrations: a Dockerfile `cp` of
  the `fonts/` dir into `dist/…/export/fonts`. `invoice-pdf.ts` resolves the dir
  relative to `import.meta.url`, so the one path works in dev, tests, and the image.

## Consequences

- **Pros**: the invoice PDF now uses the real brand typography, including tabular
  JetBrains Mono for all money/hours; a render test asserts the faces are embedded
  and the standard fonts are gone, so a regression can't silently revert it.
- **Cons / limits**: ~230 KB of font binaries in the repo + image; the variable
  faces are embedded at a single (default) weight, so emphasis uses Clash rather
  than an Inter-bold instance. The timesheet/work-time PDFs still use standard fonts
  (out of scope here). Issuer address / VAT remain unmodelled (ADR-0054).
- **Reversible**: revert `invoice-pdf.ts`'s font block, delete the `fonts/` dir, and
  drop the one Dockerfile line to return to the ADR-0054 standard-font rendering.
