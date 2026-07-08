import ExcelJS from 'exceljs'
import type { Timesheet } from '@mydevtime/domain'
import { effectiveRateMinor, hoursNumber, isoDate, moneyNumber, roundingLabel } from './format.js'
import type { TimesheetMeta } from './timesheet-source.js'

/**
 * XLSX serializer (REQ-009, ADR-0020) — the sole ExcelJS adapter; the vendor type
 * never leaves this file. Hours, rates and amounts are written as **typed number
 * cells** (not strings) so a spreadsheet can sum and format them, and the totals
 * still equal the deterministic aggregate. The rounding profile and currency are
 * embedded in the header block for auditability.
 */

const NUM = '0.00'

function period(meta: TimesheetMeta): string {
  if (!meta.from && !meta.to) return 'all time'
  return `${meta.from ? isoDate(meta.from) : '…'} – ${meta.to ? isoDate(meta.to) : '…'}`
}

export async function timesheetToXlsx(timesheet: Timesheet, meta: TimesheetMeta): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'myDevTime'
  const sheet = workbook.addWorksheet('Timesheet')

  sheet.addRow(['myDevTime timesheet'])
  sheet.addRow(['Project', meta.projectName])
  if (meta.clientName) sheet.addRow(['Client', meta.clientName])
  sheet.addRow(['Period', period(meta)])
  sheet.addRow(['Rounding', roundingLabel(timesheet.rounding)])
  sheet.addRow(['Currency', timesheet.currency])
  sheet.addRow([])

  const header = sheet.addRow(['Label', 'Description', 'Hours', 'Rate/h', 'Amount'])
  header.font = { bold: true }

  for (const line of timesheet.lines) {
    const rate = effectiveRateMinor(line.amountMinor, line.durationMs)
    const dataRow = sheet.addRow([
      line.label,
      line.note ?? '',
      hoursNumber(line.durationMs),
      rate === null ? '' : moneyNumber(rate),
      moneyNumber(line.amountMinor),
    ])
    dataRow.getCell(3).numFmt = NUM
    if (rate !== null) dataRow.getCell(4).numFmt = NUM
    dataRow.getCell(5).numFmt = NUM
  }

  const totalRow = sheet.addRow([
    'Total',
    '',
    hoursNumber(timesheet.totalDurationMs),
    '',
    moneyNumber(timesheet.totalAmountMinor),
  ])
  totalRow.font = { bold: true }
  totalRow.getCell(3).numFmt = NUM
  totalRow.getCell(5).numFmt = NUM

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
