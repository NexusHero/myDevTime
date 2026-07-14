# Invoice PDF fonts

The faces the invoice PDF (`invoice-pdf.ts`, ADR-0054) embeds, so the document uses
the real design-system typography instead of PDFKit's built-in Helvetica/Courier:

| File | Face | Role in the invoice | License |
|------|------|---------------------|---------|
| `ClashDisplay-Bold.ttf` | Clash Display Bold | wordmark, "Rechnung" title | ITF Free Font License (free for commercial use) |
| `ClashDisplay-Semibold.ttf` | Clash Display Semibold | bold UI labels (bill-to, columns, totals) | ITF Free Font License |
| `Inter.ttf` | Inter | regular body / muted text | SIL Open Font License 1.1 |
| `JetBrainsMono.ttf` | JetBrains Mono | every figure — money, hours, dates, invoice no. | SIL Open Font License 1.1 |

These `.ttf` are decoded (woff2 → ttf, no other change) from the licensed `.woff2`
the design system ships in `docs/design-system/fonts/` — the same faces the client
loads. TTF because PDFKit/fontkit embeds static TrueType reliably, whereas the
variable `.woff2` (Inter, JetBrains Mono) don't parse in its bundled woff2 decoder.

They ship next to the compiled module: the Docker build copies this directory into
`dist/…/export/fonts` (see `apps/api/Dockerfile`), and `invoice-pdf.ts` resolves it
relative to `import.meta.url`, so the same path works in dev, tests, and the image.
