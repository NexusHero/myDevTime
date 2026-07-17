import PDFDocument from 'pdfkit'
import { localParts, type MonthlyStatement } from '@mydevtime/domain'
import type { ReportMeta } from './source.js'
import type { ExportLocale } from './pdf.js'

/**
 * The monthly work-time statement as PDF (REQ-052, ADR-0065 · design v13 X) — the "real
 * punch clock" one A4 page per month. The sole PDFKit adapter for this document; the
 * vendor type never leaves this file. It renders the deterministic `MonthlyStatement`
 * (begin/pause/end, actual, target, ± per day, a cumulative balance from carryover to
 * closing, absence rows) and appends a signature block. Numbers are only *formatted*
 * here; every figure equals the domain core's (ADR-0005).
 */

interface Column {
  readonly x: number
  readonly width: number
  readonly align: 'left' | 'right'
}
const COLS = {
  date: { x: 40, width: 74, align: 'left' },
  begin: { x: 114, width: 44, align: 'right' },
  end: { x: 158, width: 44, align: 'right' },
  pause: { x: 202, width: 46, align: 'right' },
  actual: { x: 248, width: 54, align: 'right' },
  target: { x: 302, width: 50, align: 'right' },
  delta: { x: 352, width: 54, align: 'right' },
  cumul: { x: 406, width: 64, align: 'right' },
  absence: { x: 470, width: 85, align: 'left' },
} satisfies Record<string, Column>
const BOTTOM = 720

const DE = {
  title: 'Monatlicher Arbeitszeitnachweis',
  period: 'Zeitraum',
  date: 'Datum',
  begin: 'Beginn',
  end: 'Ende',
  pause: 'Pause',
  actual: 'Ist',
  target: 'Soll',
  delta: '±',
  cumul: 'Saldo',
  absence: 'Abwesenheit',
  carryover: 'Übertrag (Jahresbeginn)',
  closing: 'Saldo Monatsende',
  period_delta: 'Saldo Monat',
  employee: 'Arbeitnehmer:in',
  supervisor: 'Vorgesetzte:r',
  signature: 'Unterschrift',
  dateLine: 'Datum',
}
const EN = {
  title: 'Monthly work-time statement',
  period: 'Period',
  date: 'Date',
  begin: 'Begin',
  end: 'End',
  pause: 'Pause',
  actual: 'Actual',
  target: 'Target',
  delta: '±',
  cumul: 'Balance',
  absence: 'Absence',
  carryover: 'Carryover (year start)',
  closing: 'Closing balance',
  period_delta: 'Month balance',
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

export function monthlyStatementToPdf(
  statement: MonthlyStatement,
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
  const signed = (ms: number): string => (ms >= 0 ? `+${hours(ms)}` : `−${hours(Math.abs(ms))}`)
  const clock = (instant: number | null): string => {
    if (instant === null) return '—'
    const p = localParts(instant, meta.tz)
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `${L.title} — ${meta.monthLabel}`,
        Author: meta.workspaceName,
        CreationDate: new Date(0), // reproducible output
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    doc.on('error', reject)

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111').text(meta.workspaceName, 40, 40)
    doc.font('Helvetica').fontSize(11).fillColor('#888').text(L.title)
    doc.fillColor('#111').moveDown(0.4)
    doc.fontSize(10).text(`${L.period}: ${meta.monthLabel} (${meta.from} – ${meta.to})`)
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(`${L.carryover}: ${signed(statement.carryoverMs)} h`)
    doc.fillColor('#111').moveDown(0.8)

    // Table header
    let y = doc.y
    doc.font('Helvetica-Bold').fontSize(8)
    header(doc, L.date, COLS.date, y)
    header(doc, L.begin, COLS.begin, y)
    header(doc, L.end, COLS.end, y)
    header(doc, L.pause, COLS.pause, y)
    header(doc, L.actual, COLS.actual, y)
    header(doc, L.target, COLS.target, y)
    header(doc, L.delta, COLS.delta, y)
    header(doc, L.cumul, COLS.cumul, y)
    header(doc, L.absence, COLS.absence, y)
    y += 14
    rule(doc, y - 4)

    // Day rows
    doc.font('Helvetica').fontSize(8)
    for (const day of statement.days) {
      if (y > BOTTOM) {
        doc.addPage()
        y = 40
      }
      const shortMark = day.breakViolation ? ' *' : ''
      header(doc, day.date.slice(5), COLS.date, y) // MM-DD (year is in the period line)
      header(doc, clock(day.beginMs), COLS.begin, y)
      header(doc, clock(day.endMs), COLS.end, y)
      header(doc, hours(day.pauseMs) + shortMark, COLS.pause, y)
      header(doc, hours(day.actualMs), COLS.actual, y)
      header(doc, hours(day.targetMs), COLS.target, y)
      header(doc, signed(day.deltaMs), COLS.delta, y)
      header(doc, signed(day.cumulativeMs), COLS.cumul, y)
      header(doc, day.absence ? (ABSENCE_LABEL[day.absence] ?? day.absence) : '', COLS.absence, y)
      y += 13
    }

    // Totals
    rule(doc, y + 2)
    y += 10
    doc.font('Helvetica-Bold').fontSize(9)
    header(doc, L.period_delta, COLS.date, y)
    header(doc, hours(statement.totalActualMs), COLS.actual, y)
    header(doc, hours(statement.totalTargetMs), COLS.target, y)
    header(doc, signed(statement.periodDeltaMs), COLS.delta, y)
    header(doc, signed(statement.closingBalanceMs), COLS.cumul, y)
    y += 16
    doc.font('Helvetica').fontSize(9).fillColor('#111')
    doc.text(`${L.closing}: ${signed(statement.closingBalanceMs)} h`, 40, y)
    y += 16
    doc.fontSize(7.5).fillColor('#888').text(statement.auditNote, 40, y, { width: 515 })
    doc.fillColor('#111')

    // Signature blocks
    const sigY = Math.max(y + 50, BOTTOM)
    signature(doc, 40, sigY, L.employee, L)
    signature(doc, 320, sigY, L.supervisor, L)

    doc.end()
  })
}

function header(doc: PDFKit.PDFDocument, text: string, col: Column, y: number): void {
  doc.text(text, col.x, y, { width: col.width, align: col.align, lineBreak: false })
}
function rule(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .moveTo(40, y)
    .lineTo(555, y)
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
