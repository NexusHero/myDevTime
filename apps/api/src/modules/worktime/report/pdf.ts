import PDFDocument from 'pdfkit'
import type { WorktimeReport } from '@mydevtime/domain'
import type { ReportMeta } from './source.js'

/**
 * The signable work-time report as PDF (REQ-030, ADR-0010) — the sole PDFKit
 * adapter for this document; the vendor type never leaves this file. Renders the
 * deterministic `WorktimeReport` (per-day worked/break/target/absence, totals) and
 * appends **signature blocks** for employee and supervisor so it can be printed
 * and countersigned. Numbers only formatted here; the totals equal the core's.
 * The break-rule preset is named on the page — a hint, not legal certification.
 */
export type ExportLocale = 'en' | 'de'

interface Column {
  readonly x: number
  readonly width: number
  readonly align: 'left' | 'right'
}
const COLS: Record<'date' | 'worked' | 'break' | 'target' | 'absence', Column> = {
  date: { x: 50, width: 110, align: 'left' },
  worked: { x: 165, width: 90, align: 'right' },
  break: { x: 260, width: 90, align: 'right' },
  target: { x: 355, width: 90, align: 'right' },
  absence: { x: 450, width: 95, align: 'left' },
}
const BOTTOM = 720

const DE = {
  title: 'Arbeitszeitnachweis',
  period: 'Zeitraum',
  date: 'Datum',
  worked: 'Gearbeitet',
  brk: 'Pause',
  target: 'Soll',
  absence: 'Abwesenheit',
  totalWorked: 'Summe gearbeitet',
  totalTarget: 'Summe Soll',
  overtime: 'Überstunden-Saldo',
  violations: 'Pausenregel-Hinweise (Tage)',
  preset: 'Pausenregel: ArbZG §4 — Hinweis, keine Rechtsberatung',
  employee: 'Arbeitnehmer:in',
  supervisor: 'Vorgesetzte:r',
  signature: 'Unterschrift',
  dateLine: 'Datum',
}
const EN = {
  title: 'Work-time report',
  period: 'Period',
  date: 'Date',
  worked: 'Worked',
  brk: 'Break',
  target: 'Target',
  absence: 'Absence',
  totalWorked: 'Total worked',
  totalTarget: 'Total target',
  overtime: 'Overtime balance',
  violations: 'Break-rule hints (days)',
  preset: 'Break rule: ArbZG §4 — a hint, not legal advice',
  employee: 'Employee',
  supervisor: 'Supervisor',
  signature: 'Signature',
  dateLine: 'Date',
}

const ABSENCE_LABEL: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  holiday: 'Holiday',
  other: 'Other',
}

export function worktimeReportToPdf(
  report: WorktimeReport,
  meta: ReportMeta,
  locale: ExportLocale = 'en',
): Promise<Buffer> {
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const nf = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const L = locale === 'de' ? DE : EN
  const hours = (ms: number): string => nf.format(ms / 3_600_000)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `${L.title} — ${meta.monthLabel}`,
        Author: meta.workspaceName,
        // Pinned so output is reproducible, not clock-dependent.
        CreationDate: new Date(0),
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    doc.on('error', reject)

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111').text(meta.workspaceName, 50, 50)
    doc.font('Helvetica').fontSize(11).fillColor('#888').text(L.title)
    doc.fillColor('#111').moveDown(0.5)
    doc.fontSize(10).text(`${L.period}: ${meta.monthLabel} (${meta.from} – ${meta.to})`)
    doc.moveDown(1)

    // Table header
    let y = doc.y
    doc.font('Helvetica-Bold').fontSize(9)
    cell(doc, L.date, COLS.date, y)
    cell(doc, L.worked, COLS.worked, y)
    cell(doc, L.brk, COLS.break, y)
    cell(doc, L.target, COLS.target, y)
    cell(doc, L.absence, COLS.absence, y)
    y += 16
    rule(doc, y - 4)

    // Day rows
    doc.font('Helvetica').fontSize(9)
    for (const day of report.days) {
      if (y > BOTTOM) {
        doc.addPage()
        y = 50
      }
      const shortMark = day.breakShortfallMs > 0 ? ' *' : ''
      cell(doc, day.date, COLS.date, y)
      cell(doc, hours(day.workedMs), COLS.worked, y)
      cell(doc, hours(day.breakMs) + shortMark, COLS.break, y)
      cell(doc, hours(day.targetMs), COLS.target, y)
      cell(doc, day.absence ? (ABSENCE_LABEL[day.absence] ?? day.absence) : '', COLS.absence, y)
      y += 14
    }

    // Totals
    rule(doc, y + 2)
    y += 10
    doc.font('Helvetica-Bold').fontSize(10)
    cell(doc, L.totalWorked, COLS.date, y)
    cell(doc, hours(report.totalWorkedMs), COLS.worked, y)
    cell(doc, hours(report.totalBreakMs), COLS.break, y)
    cell(doc, hours(report.totalTargetMs), COLS.target, y)
    y += 16
    doc.font('Helvetica').fontSize(10)
    cell(doc, `${L.overtime}: ${hours(report.overtimeMs)} h`, COLS.date, y)
    y += 14
    cell(doc, `${L.violations}: ${String(report.breakViolationDays)}`, COLS.date, y)
    y += 20
    doc.fontSize(8).fillColor('#888').text(L.preset, 50, y)
    doc.fillColor('#111')

    // Signature blocks
    const sigY = Math.max(y + 60, BOTTOM)
    signature(doc, 50, sigY, L.employee, L)
    signature(doc, 320, sigY, L.supervisor, L)

    doc.end()
  })
}

function cell(doc: PDFKit.PDFDocument, text: string, col: Column, y: number): void {
  doc.text(text, col.x, y, { width: col.width, align: col.align, lineBreak: false })
}
function rule(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .moveTo(50, y)
    .lineTo(545, y)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()
    .strokeColor('#111')
}
function signature(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  role: string,
  L: typeof EN,
): void {
  doc
    .moveTo(x, y)
    .lineTo(x + 200, y)
    .strokeColor('#111')
    .lineWidth(0.5)
    .stroke()
  doc.font('Helvetica').fontSize(8).fillColor('#555')
  doc.text(`${role} — ${L.signature}`, x, y + 4, { width: 200, lineBreak: false })
  doc
    .moveTo(x, y + 40)
    .lineTo(x + 200, y + 40)
    .stroke()
  doc.text(L.dateLine, x, y + 44, { width: 200, lineBreak: false })
  doc.fillColor('#111')
}
