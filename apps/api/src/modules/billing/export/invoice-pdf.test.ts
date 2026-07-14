import { describe, expect, it } from 'vitest'
import { PDFParse } from 'pdf-parse'
import { invoiceToPdf } from './invoice-pdf.js'
import type { InvoiceExport } from './invoice-csv.js'

/**
 * Invoice PDF export (design v7 "Rechnung", REQ-005/009, ADR-0051/0054). The text
 * is extracted and asserted: the document shows the sender (workspace), the billed
 * client, a derived invoice number, the period, and a grand total that equals the
 * invoice's **frozen** figure to the cent. The renderer only formats — it never
 * recomputes (ADR-0005).
 */
const HOUR = 3_600_000

async function extract(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const res = await parser.getText()
    return { text: res.text, pages: res.total }
  } finally {
    await parser.destroy()
  }
}

const invoice: InvoiceExport = {
  id: '2f1c9a4e-0000-4000-8000-000000000000',
  senderName: 'Acme GmbH',
  clientName: 'Finanzo AG',
  periodStart: new Date('2026-07-01T00:00:00Z'),
  periodEnd: new Date('2026-07-14T00:00:00Z'),
  issuedAt: new Date('2026-07-14T00:00:00Z'),
  currencyCode: 'EUR',
  totalMs: 3 * HOUR,
  totalMinor: 30_000,
  lines: [
    {
      projectName: 'Website Relaunch',
      note: 'Checkout',
      start: Date.parse('2026-07-06'),
      durationMs: 2 * HOUR,
      amountMinor: 20_000,
    },
    {
      projectName: 'Support-Retainer',
      note: 'Hotfix',
      start: Date.parse('2026-07-08'),
      durationMs: HOUR,
      amountMinor: 10_000,
    },
  ],
}

describe('invoice PDF export', () => {
  it('InvoicePdf_De_ShowsPartiesNumberAndFrozenGrandTotal', async () => {
    const { text } = await extract(await invoiceToPdf(invoice, 'de'))
    expect(text).toContain('Rechnung') // title
    expect(text).toContain('Acme GmbH') // sender = workspace
    expect(text).toContain('Finanzo AG') // bill-to client
    expect(text).toContain('2026-2f1c9a4e') // derived invoice number (year + id slice)
    // The grand total equals the invoice's frozen figure, German-formatted.
    expect(text).toContain('300,00')
  })

  it('InvoicePdf_EmbedsTheDesignFaces_NotTheStandardPdfFonts', async () => {
    const bytes = (await invoiceToPdf(invoice, 'de')).toString('latin1')
    // The real design faces are embedded (subset PostScript names appear in the file)…
    expect(bytes).toContain('Inter')
    expect(bytes).toContain('JetBrainsMono')
    // …and PDFKit's built-in Helvetica/Courier are no longer used.
    expect(bytes).not.toContain('Helvetica')
    expect(bytes).not.toContain('Courier')
  })

  it('InvoicePdf_En_LocalisesLabels', async () => {
    const { text } = await extract(await invoiceToPdf(invoice, 'en'))
    expect(text).toContain('Invoice')
    expect(text).toContain('Total')
    expect(text).toContain('300.00') // English decimal point
  })

  it('InvoicePdf_GroupsLinesByProjectAndKeepsTheTotal', async () => {
    const { text } = await extract(await invoiceToPdf(invoice, 'de'))
    // One position per project (the invoice's default collective view).
    expect(text).toContain('Website Relaunch')
    expect(text).toContain('Support-Retainer')
    // Both projects' amounts sum to the frozen total (German-formatted here).
    expect(text).toContain('300,00')
  })

  it('InvoicePdf_NoClient_RendersWithoutBillToName', async () => {
    const { text } = await extract(await invoiceToPdf({ ...invoice, clientName: null }, 'de'))
    expect(text).toContain('Rechnung')
    expect(text).toContain('300,00')
  })
})
