import { describe, expect, it } from 'vitest'
import { invoiceToCsv, type InvoiceExport } from './invoice-csv.js'

/**
 * The invoice CSV writer is a pure, byte-reproducible serializer (RFC 4180): the
 * bytes are locale-neutral (comma fields, dot decimals, ISO dates, CRLF) and the
 * Total row is the invoice's frozen figures. These pin the header block, a line,
 * and quoting of fields that contain commas.
 */
const H = 3_600_000
const INVOICE: InvoiceExport = {
  id: 'inv-1',
  clientName: 'Finanzo AG',
  periodStart: new Date('2026-07-01T00:00:00.000Z'),
  periodEnd: new Date('2026-08-01T00:00:00.000Z'),
  issuedAt: new Date('2026-07-14T00:00:00.000Z'),
  currencyCode: 'EUR',
  totalMs: 3 * H,
  totalMinor: 30_000,
  lines: [
    {
      projectName: 'Website',
      note: 'Checkout, sync',
      start: Date.parse('2026-07-05T09:00:00.000Z'),
      durationMs: 2 * H,
      amountMinor: 20_000,
    },
    {
      projectName: 'API',
      note: null,
      start: Date.parse('2026-07-06T09:00:00.000Z'),
      durationMs: 1 * H,
      amountMinor: 10_000,
    },
  ],
}

describe('invoiceToCsv', () => {
  it('invoiceToCsv_headerCarriesInvoiceMeta', () => {
    const csv = invoiceToCsv(INVOICE)
    expect(csv).toContain('myDevTime invoice')
    expect(csv).toContain('Invoice,inv-1')
    expect(csv).toContain('Client,Finanzo AG')
    expect(csv).toContain('Period,2026-07-01 – 2026-08-01')
    expect(csv).toContain('Currency,EUR')
  })

  it('invoiceToCsv_pricesLinesAndQuotesCommas', () => {
    const csv = invoiceToCsv(INVOICE)
    // A note with a comma is quoted; rate/h = 20000/2h = 10000 minor → "100.00".
    expect(csv).toContain('2026-07-05,Website,"Checkout, sync",2.00,100.00,200.00')
  })

  it('invoiceToCsv_totalRowIsFrozenTotals', () => {
    const csv = invoiceToCsv(INVOICE)
    expect(csv).toContain('Total,,,3.00,,300.00')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
