import PDFDocument from 'pdfkit'
import type { Timesheet } from '@mydevtime/domain'
import { effectiveRateMinor, roundingLabel } from './format.js'
import type { TimesheetMeta } from './timesheet-source.js'

/**
 * PDF serializer (REQ-009, ADR-0020) — the sole PDFKit adapter; the vendor type
 * never leaves this file. Renders the deterministic `buildTimesheet` as a
 * client-presentable document (sender / client / period / itemized table /
 * total). Numbers and dates are localized (de/en) via `Intl`; the totals still
 * equal the aggregate — the layout only formats. The creation date is pinned to
 * the report period so output is reproducible, not clock-dependent.
 */

export type ExportLocale = 'en' | 'de'

interface Column {
  readonly x: number
  readonly width: number
  readonly align: 'left' | 'right'
}
const COLS: Record<'label' | 'desc' | 'hours' | 'rate' | 'amount', Column> = {
  label: { x: 50, width: 85, align: 'left' },
  desc: { x: 140, width: 185, align: 'left' },
  hours: { x: 325, width: 55, align: 'right' },
  rate: { x: 385, width: 70, align: 'right' },
  amount: { x: 460, width: 85, align: 'right' },
}
const BOTTOM = 780 // A4 height 842 − bottom margin

export function timesheetToPdf(
  timesheet: Timesheet,
  meta: TimesheetMeta,
  locale: ExportLocale = 'en',
): Promise<Buffer> {
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const nf = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const df = new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const t = locale === 'de' ? DE : EN

  const money = (minor: number): string => `${nf.format(minor / 100)} ${timesheet.currency}`
  const hours = (ms: number): string => nf.format(ms / 3_600_000)
  const period = (): string => {
    if (!meta.from && !meta.to) return t.allTime
    return `${meta.from ? df.format(meta.from) : '…'} – ${meta.to ? df.format(meta.to) : '…'}`
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `${t.title} — ${meta.projectName}`,
        Author: meta.workspaceName,
        CreationDate: meta.from ?? new Date(0),
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
    doc.font('Helvetica').fontSize(11).fillColor('#888').text(t.title)
    doc.fillColor('#111').moveDown(1)

    // Meta block
    doc.fontSize(10)
    if (meta.clientName) doc.text(`${t.client}: ${meta.clientName}`)
    doc.text(`${t.project}: ${meta.projectName}`)
    doc.text(`${t.period}: ${period()}`)
    doc.fillColor('#888').text(`${t.rounding}: ${roundingLabel(timesheet.rounding)}`)
    doc.fillColor('#111').moveDown(1)

    // Table header
    let y = doc.y
    doc.font('Helvetica-Bold').fontSize(9)
    cell(doc, t.date, COLS.label, y)
    cell(doc, t.description, COLS.desc, y)
    cell(doc, t.hours, COLS.hours, y)
    cell(doc, t.rate, COLS.rate, y)
    cell(doc, t.amount, COLS.amount, y)
    y += 16
    rule(doc, y - 4)

    // Rows
    doc.font('Helvetica').fontSize(9)
    for (const line of timesheet.lines) {
      if (y > BOTTOM) {
        doc.addPage()
        y = 50
      }
      const rate = effectiveRateMinor(line.amountMinor, line.durationMs)
      cell(doc, line.label, COLS.label, y)
      cell(doc, line.note ?? '', COLS.desc, y)
      cell(doc, hours(line.durationMs), COLS.hours, y)
      cell(doc, rate === null ? '' : money(rate), COLS.rate, y)
      cell(doc, money(line.amountMinor), COLS.amount, y)
      y += 15
    }

    // Total
    rule(doc, y + 2)
    y += 8
    doc.font('Helvetica-Bold').fontSize(10)
    cell(doc, t.total, COLS.label, y)
    cell(doc, hours(timesheet.totalDurationMs), COLS.hours, y)
    cell(doc, money(timesheet.totalAmountMinor), COLS.amount, y)

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

interface Labels {
  title: string
  client: string
  project: string
  period: string
  rounding: string
  date: string
  description: string
  hours: string
  rate: string
  amount: string
  total: string
  allTime: string
}
const EN: Labels = {
  title: 'Timesheet',
  client: 'Client',
  project: 'Project',
  period: 'Period',
  rounding: 'Rounding',
  date: 'Date',
  description: 'Description',
  hours: 'Hours',
  rate: 'Rate/h',
  amount: 'Amount',
  total: 'Total',
  allTime: 'all time',
}
const DE: Labels = {
  title: 'Leistungsnachweis',
  client: 'Kunde',
  project: 'Projekt',
  period: 'Zeitraum',
  rounding: 'Rundung',
  date: 'Datum',
  description: 'Beschreibung',
  hours: 'Stunden',
  rate: 'Satz/h',
  amount: 'Betrag',
  total: 'Summe',
  allTime: 'gesamt',
}
