import ExcelJS from 'exceljs'
import type { WorktimeReport } from '@mydevtime/domain'
import type { ReportMeta } from './source.js'

/**
 * The signable work-time report as XLSX (REQ-030, ADR-0010) — the sole ExcelJS
 * adapter for this document; the vendor type never leaves this file. Hours are
 * written as **typed number cells** so a spreadsheet can sum and format them, and
 * the totals equal the deterministic core's. Absence days and the break-rule
 * hint count are included for auditability; signature rows close the sheet.
 */
const NUM = '0.00'
const hrs = (ms: number): number => ms / 3_600_000

const ABSENCE_LABEL: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  holiday: 'Holiday',
  other: 'Other',
}

export async function worktimeReportToXlsx(
  report: WorktimeReport,
  meta: ReportMeta,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'myDevTime'
  const sheet = workbook.addWorksheet('Work-time report')

  sheet.addRow(['myDevTime work-time report'])
  sheet.addRow(['Workspace', meta.workspaceName])
  sheet.addRow(['Period', `${meta.monthLabel} (${meta.from} – ${meta.to})`])
  sheet.addRow(['Time zone', meta.tz])
  sheet.addRow(['Break rule', 'ArbZG §4 — a hint, not legal advice'])
  sheet.addRow([])

  const header = sheet.addRow([
    'Date',
    'Worked (h)',
    'Break (h)',
    'Target (h)',
    'Absence',
    'Break short (h)',
  ])
  header.font = { bold: true }

  for (const day of report.days) {
    const row = sheet.addRow([
      day.date,
      hrs(day.workedMs),
      hrs(day.breakMs),
      hrs(day.targetMs),
      day.absence ? (ABSENCE_LABEL[day.absence] ?? day.absence) : '',
      day.breakShortfallMs > 0 ? hrs(day.breakShortfallMs) : '',
    ])
    row.getCell(2).numFmt = NUM
    row.getCell(3).numFmt = NUM
    row.getCell(4).numFmt = NUM
    if (day.breakShortfallMs > 0) row.getCell(6).numFmt = NUM
  }

  sheet.addRow([])
  const totals = sheet.addRow([
    'Total',
    hrs(report.totalWorkedMs),
    hrs(report.totalBreakMs),
    hrs(report.totalTargetMs),
    '',
    '',
  ])
  totals.font = { bold: true }
  totals.getCell(2).numFmt = NUM
  totals.getCell(3).numFmt = NUM
  totals.getCell(4).numFmt = NUM

  const overtime = sheet.addRow(['Overtime balance (h)', hrs(report.overtimeMs)])
  overtime.getCell(2).numFmt = NUM
  sheet.addRow(['Break-rule hints (days)', report.breakViolationDays])
  sheet.addRow([
    'Absence days',
    `vacation ${String(report.absenceDaysByKind.vacation)} · sick ${String(report.absenceDaysByKind.sick)} · holiday ${String(report.absenceDaysByKind.holiday)}`,
  ])

  sheet.addRow([])
  sheet.addRow(['Employee — signature', '', 'Date', ''])
  sheet.addRow(['Supervisor — signature', '', 'Date', ''])

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
