import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTimesheet, type TimesheetEntryInput } from '@mydevtime/domain'
import { timesheetToCsv } from './csv.js'
import { timesheetToXlsx } from './xlsx.js'
import { moneyMajor, moneyNumber } from './format.js'
import type { TimesheetMeta } from './timesheet-source.js'

/**
 * Export serializers (REQ-009). The acceptance-critical property: CSV, XLSX and
 * the domain aggregate agree to the cent — the serializers only format, never
 * re-compute. Runs without a database.
 */
const HOUR = 3_600_000

const meta: TimesheetMeta = {
  workspaceName: 'Acme GmbH',
  projectName: 'Website Relaunch',
  clientName: 'Globex',
  from: new Date('2026-06-01T00:00:00Z'),
  to: new Date('2026-07-01T00:00:00Z'),
  groupBy: 'entry',
}

const entries: TimesheetEntryInput[] = [
  {
    durationMs: HOUR,
    rateMinorPerHour: 9000,
    billable: true,
    groupKey: 'e1',
    groupLabel: '2026-06-02',
    note: 'kickoff',
  },
  {
    durationMs: 90 * 60_000,
    rateMinorPerHour: 9000,
    billable: true,
    groupKey: 'e2',
    groupLabel: '2026-06-03',
    note: 'build',
  },
]
const timesheet = buildTimesheet(entries, {
  rounding: { mode: 'nearest', incrementMinutes: 15 },
  currency: 'EUR',
})

describe('timesheet export', () => {
  it('Csv_EmbedsRoundingAndCurrency_AndTotalsMatchAggregate', () => {
    const csv = timesheetToCsv(timesheet, meta)
    expect(csv).toContain('Rounding,nearest / 15 min')
    expect(csv).toContain('Currency,EUR')
    const totalRow = csv.split('\r\n').find(l => l.startsWith('Total'))
    const totalAmount = totalRow?.split(',').at(-1)
    expect(totalAmount).toBe(moneyMajor(timesheet.totalAmountMinor))
  })

  it('Csv_QuotesFieldsContainingCommas', () => {
    const tricky = buildTimesheet(
      [
        {
          durationMs: HOUR,
          rateMinorPerHour: 6000,
          billable: true,
          groupKey: 'e1',
          groupLabel: 'x',
          note: 'design, dev',
        },
      ],
      { rounding: { mode: 'none', incrementMinutes: 1 }, currency: 'EUR' },
    )
    expect(timesheetToCsv(tricky, meta)).toContain('"design, dev"')
  })

  it('Xlsx_TotalCell_IsATypedNumberEqualToAggregate', async () => {
    const buffer = await timesheetToXlsx(timesheet, meta)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const sheet = workbook.getWorksheet('Timesheet')
    expect(sheet).toBeDefined()
    let totalAmount: unknown
    sheet?.eachRow(row => {
      if (row.getCell(1).value === 'Total') totalAmount = row.getCell(5).value
    })
    expect(typeof totalAmount).toBe('number')
    expect(totalAmount).toBe(moneyNumber(timesheet.totalAmountMinor))
  })

  it('CsvTotal_EqualsXlsxTotal_EqualsDomainAggregate', async () => {
    const csv = timesheetToCsv(timesheet, meta)
    const csvTotal = csv
      .split('\r\n')
      .find(l => l.startsWith('Total'))
      ?.split(',')
      .at(-1)

    const buffer = await timesheetToXlsx(timesheet, meta)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    let xlsxTotal = 0
    workbook.getWorksheet('Timesheet')?.eachRow(row => {
      if (row.getCell(1).value === 'Total') xlsxTotal = Number(row.getCell(5).value)
    })

    expect(csvTotal).toBe(moneyMajor(timesheet.totalAmountMinor))
    expect(xlsxTotal).toBe(moneyNumber(timesheet.totalAmountMinor))
    // The three agree to the cent.
    expect(Math.round(xlsxTotal * 100)).toBe(timesheet.totalAmountMinor)
  })
})
