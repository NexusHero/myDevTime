import { effectiveRateMinor, hoursDecimal, isoDate, moneyMajor } from './format.js'

/**
 * Invoice CSV serializer (design v6 / REQ-005/009) — the same small, dependency-
 * free RFC 4180 writer style as the timesheet export: locale-neutral bytes (comma
 * fields, dot decimals, ISO dates, CRLF) so the output is byte-reproducible for
 * golden-file tests. The totals are the invoice's **frozen** figures, never
 * recomputed here (ADR-0005) — this layer only formats what was issued.
 */

export interface InvoiceExportLine {
  readonly projectName: string
  readonly note: string | null
  readonly start: number
  readonly durationMs: number
  readonly amountMinor: number
}

export interface InvoiceExport {
  readonly id: string
  readonly clientName: string | null
  readonly periodStart: Date
  readonly periodEnd: Date
  readonly issuedAt: Date
  readonly currencyCode: string
  readonly totalMs: number
  readonly totalMinor: number
  readonly lines: readonly InvoiceExportLine[]
}

function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
function row(fields: readonly string[]): string {
  return fields.map(field).join(',')
}

export function invoiceToCsv(invoice: InvoiceExport): string {
  const rows: string[] = [
    row(['myDevTime invoice']),
    row(['Invoice', invoice.id]),
    row(['Client', invoice.clientName ?? '']),
    row(['Period', `${isoDate(invoice.periodStart)} – ${isoDate(invoice.periodEnd)}`]),
    row(['Issued', isoDate(invoice.issuedAt)]),
    row(['Currency', invoice.currencyCode]),
    '',
    row(['Date', 'Project', 'Description', 'Hours', 'Rate/h', 'Amount']),
  ]
  for (const line of invoice.lines) {
    const rate = effectiveRateMinor(line.amountMinor, line.durationMs)
    rows.push(
      row([
        isoDate(new Date(line.start)),
        line.projectName,
        line.note ?? '',
        hoursDecimal(line.durationMs),
        rate === null ? '' : moneyMajor(rate),
        moneyMajor(line.amountMinor),
      ]),
    )
  }
  rows.push(
    row(['Total', '', '', hoursDecimal(invoice.totalMs), '', moneyMajor(invoice.totalMinor)]),
  )
  return rows.join('\r\n') + '\r\n'
}
