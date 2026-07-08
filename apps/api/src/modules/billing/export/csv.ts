import type { Timesheet } from '@mydevtime/domain'
import { effectiveRateMinor, hoursDecimal, isoDate, moneyMajor, roundingLabel } from './format.js'
import type { TimesheetMeta } from './timesheet-source.js'

/**
 * CSV serializer (REQ-009) — a small pure RFC 4180 writer, no dependency. Bytes
 * are locale-neutral and stable (comma-separated, dot decimals, ISO dates, CRLF),
 * so the output is byte-reproducible for golden-file tests. The rounding profile
 * and currency are embedded in the header block for auditability.
 */

function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
function row(fields: readonly string[]): string {
  return fields.map(field).join(',')
}

function period(meta: TimesheetMeta): string {
  if (!meta.from && !meta.to) return 'all time'
  return `${meta.from ? isoDate(meta.from) : '…'} – ${meta.to ? isoDate(meta.to) : '…'}`
}

export function timesheetToCsv(timesheet: Timesheet, meta: TimesheetMeta): string {
  const rows: string[] = [row(['myDevTime timesheet']), row(['Project', meta.projectName])]
  if (meta.clientName) rows.push(row(['Client', meta.clientName]))
  rows.push(row(['Period', period(meta)]))
  rows.push(row(['Rounding', roundingLabel(timesheet.rounding)]))
  rows.push(row(['Currency', timesheet.currency]))
  rows.push('')
  rows.push(row(['Label', 'Description', 'Hours', 'Rate/h', 'Amount']))

  for (const line of timesheet.lines) {
    const rate = effectiveRateMinor(line.amountMinor, line.durationMs)
    rows.push(
      row([
        line.label,
        line.note ?? '',
        hoursDecimal(line.durationMs),
        rate === null ? '' : moneyMajor(rate),
        moneyMajor(line.amountMinor),
      ]),
    )
  }
  rows.push(
    row([
      'Total',
      '',
      hoursDecimal(timesheet.totalDurationMs),
      '',
      moneyMajor(timesheet.totalAmountMinor),
    ]),
  )
  return rows.join('\r\n') + '\r\n'
}
