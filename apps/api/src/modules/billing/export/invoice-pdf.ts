import PDFDocument from 'pdfkit'
import { effectiveRateMinor } from './format.js'
import type { ExportLocale } from './pdf.js'
import type { InvoiceExport, InvoiceExportLine } from './invoice-csv.js'

/**
 * Invoice PDF serializer (design v7 "Rechnung", REQ-005/009, ADR-0051/0054) — the
 * sole PDFKit adapter for invoices; the vendor type never leaves this file. It
 * renders the **frozen** invoice (`getInvoiceExport`) in the warm DevTime invoice
 * look: sender = the workspace, bill-to = the client, positions grouped one-per-
 * project (the invoice's default collective view), and a dark grand-total block
 * whose figure is the invoice's stored `totalMinor` — never recomputed (ADR-0005).
 *
 * The v7 template also mocks up a freelancer's address, bank, and tax lines and an
 * optional 19 % VAT row. Those are **not** part of the invoice model (no such
 * fields exist on the workspace, and VAT is not in the frozen figures), so we do
 * not fabricate them here — the document carries only data we actually hold. Adding
 * issuer profile + tax config is tracked as follow-up.
 */

// v7 "Rechnung" palette.
const INK = '#101828'
const MUTED = '#667085'
const FAINT = '#98a2b3'
const HAIRLINE = '#f2e9e2'
const ACCENT = '#ff5320'
const ACCENT_SOFT = '#ff8a5c'
const PAPER = '#fffcf8'

const LEFT = 50
const RIGHT = 545 // A4 width 595 − 50 margin
const BOTTOM = 790

interface Column {
  readonly x: number
  readonly width: number
  readonly align: 'left' | 'right'
}
const COLS: Record<'proj' | 'date' | 'hours' | 'rate' | 'amount', Column> = {
  proj: { x: LEFT, width: 210, align: 'left' },
  date: { x: 270, width: 80, align: 'left' },
  hours: { x: 350, width: 55, align: 'right' },
  rate: { x: 410, width: 65, align: 'right' },
  amount: { x: 480, width: RIGHT - 480, align: 'right' },
}

/** One collective position per project (title, span, summed hours + amount). */
interface Position {
  project: string
  count: number
  firstStart: number
  lastStart: number
  durationMs: number
  amountMinor: number
}

/** Group priced lines by project — deterministic, order by first appearance. */
export function groupByProject(lines: readonly InvoiceExportLine[]): readonly Position[] {
  // A Map preserves insertion order, so accumulating in place keeps first-
  // appearance order without a second lookup that the type-checker can't prove.
  const by = new Map<string, Position>()
  for (const l of lines) {
    const prev = by.get(l.projectName)
    if (prev) {
      prev.count += 1
      prev.firstStart = Math.min(prev.firstStart, l.start)
      prev.lastStart = Math.max(prev.lastStart, l.start)
      prev.durationMs += l.durationMs
      prev.amountMinor += l.amountMinor
    } else {
      by.set(l.projectName, {
        project: l.projectName,
        count: 1,
        firstStart: l.start,
        lastStart: l.start,
        durationMs: l.durationMs,
        amountMinor: l.amountMinor,
      })
    }
  }
  return [...by.values()]
}

/** A friendly, deterministic invoice number derived from the frozen record. */
export function invoiceNumber(invoice: Pick<InvoiceExport, 'id' | 'issuedAt'>): string {
  return `${String(invoice.issuedAt.getUTCFullYear())}-${invoice.id.slice(0, 8)}`
}

export function invoiceToPdf(invoice: InvoiceExport, locale: ExportLocale = 'en'): Promise<Buffer> {
  const intlLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const nf = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const hf = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const df = new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dfShort = new Intl.DateTimeFormat(intlLocale, { month: '2-digit', day: '2-digit' })
  const t = locale === 'de' ? DE : EN

  const money = (minor: number): string => `${nf.format(minor / 100)} ${invoice.currencyCode}`
  const hours = (ms: number): string => `${hf.format(ms / 3_600_000)} h`
  const positions = groupByProject(invoice.lines)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: LEFT,
      info: {
        Title: `${t.title} ${invoiceNumber(invoice)}`,
        Author: invoice.senderName,
        CreationDate: invoice.issuedAt,
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    doc.on('error', reject)

    // Warm paper background.
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAPER)

    // Header: wordmark (left) · sender / issuer (right).
    doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text('myDevTime', LEFT, 52)
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(INK)
      .text(invoice.senderName, RIGHT - 260, 52, { width: 260, align: 'right' })
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(t.issuer, RIGHT - 260, 68, { width: 260, align: 'right' })

    // Accent rule (orange lead-in, then hairline).
    doc.rect(LEFT, 96, 70, 3).fill(ACCENT)
    doc.rect(LEFT + 70, 96, RIGHT - LEFT - 70, 3).fill(HAIRLINE)

    // Bill-to (left) · title + meta (right).
    let y = 128
    doc.font('Helvetica-Bold').fontSize(9).fillColor(FAINT).text(t.billTo.toUpperCase(), LEFT, y)
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(INK)
      .text(invoice.clientName ?? t.noClient, LEFT, y + 14)

    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor(INK)
      .text(t.title, RIGHT - 260, y - 4, {
        width: 260,
        align: 'right',
      })
    const metaLines = [
      `${t.number}  ${invoiceNumber(invoice)}`,
      `${t.date}  ${df.format(invoice.issuedAt)}`,
      `${t.period}  ${df.format(invoice.periodStart)} – ${df.format(invoice.periodEnd)}`,
    ]
    doc.font('Courier').fontSize(10).fillColor(MUTED)
    let my = y + 30
    for (const line of metaLines) {
      doc.text(line, RIGHT - 300, my, { width: 300, align: 'right' })
      my += 15
    }

    // Table header.
    y = 210
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FAINT)
    cell(doc, t.service.toUpperCase(), COLS.proj, y)
    cell(doc, t.span.toUpperCase(), COLS.date, y)
    cell(doc, t.hoursShort.toUpperCase(), COLS.hours, y)
    cell(doc, t.rate.toUpperCase(), COLS.rate, y)
    cell(doc, t.amount.toUpperCase(), COLS.amount, y)
    y += 14
    rule(doc, y, INK, 1)
    y += 10

    // Positions (one per project).
    doc.fillColor(INK)
    for (const p of positions) {
      if (y > BOTTOM) {
        doc.addPage()
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAPER)
        y = 60
      }
      const rate = effectiveRateMinor(p.amountMinor, p.durationMs)
      const span =
        p.firstStart === p.lastStart
          ? dfShort.format(new Date(p.firstStart))
          : `${dfShort.format(new Date(p.firstStart))}–${dfShort.format(new Date(p.lastStart))}`
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
      cell(doc, p.project, COLS.proj, y)
      doc.font('Helvetica').fontSize(8.5).fillColor(FAINT)
      cell(doc, t.entries(p.count), { ...COLS.proj, width: COLS.proj.width }, y + 13)
      doc.font('Courier').fontSize(10).fillColor(MUTED)
      cell(doc, span, COLS.date, y + 1)
      doc.fillColor(INK)
      cell(doc, hours(p.durationMs), COLS.hours, y + 1)
      doc.fillColor(MUTED)
      cell(doc, rate === null ? '' : money(rate), COLS.rate, y + 1)
      doc.font('Courier-Bold').fontSize(10.5).fillColor(INK)
      cell(doc, money(p.amountMinor), COLS.amount, y + 1)
      y += 30
      rule(doc, y - 6, HAIRLINE, 1)
    }

    // Totals — subtotal line + dark grand-total block, right-aligned (width 260).
    y += 12
    const boxX = RIGHT - 260
    doc.font('Helvetica').fontSize(11).fillColor(MUTED)
    doc.text(t.totalHours, boxX, y, { width: 150 })
    doc
      .font('Courier')
      .fillColor(INK)
      .text(hours(invoice.totalMs), boxX + 150, y, {
        width: 110,
        align: 'right',
      })
    y += 24
    doc.rect(boxX, y, 260, 44).fill(INK)
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#ffffff')
      .text(t.grandTotal, boxX + 16, y + 15, { width: 120 })
    doc
      .font('Courier-Bold')
      .fontSize(16)
      .fillColor(ACCENT_SOFT)
      .text(money(invoice.totalMinor), boxX + 120, y + 13, { width: 124, align: 'right' })

    // Footer note.
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(FAINT)
      .text(t.footer(hours(invoice.totalMs)), LEFT, BOTTOM + 8, { width: RIGHT - LEFT })

    doc.end()
  })
}

function cell(doc: PDFKit.PDFDocument, text: string, col: Column, y: number): void {
  doc.text(text, col.x, y, { width: col.width, align: col.align, lineBreak: false })
}
function rule(doc: PDFKit.PDFDocument, y: number, color: string, width: number): void {
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(color).lineWidth(width).stroke()
}

interface Labels {
  title: string
  issuer: string
  billTo: string
  noClient: string
  number: string
  date: string
  period: string
  service: string
  span: string
  hoursShort: string
  rate: string
  amount: string
  totalHours: string
  grandTotal: string
  entries: (n: number) => string
  footer: (hours: string) => string
}
const EN: Labels = {
  title: 'Invoice',
  issuer: 'Software development',
  billTo: 'Bill to',
  noClient: 'Workspace',
  number: 'No.',
  date: 'Date',
  period: 'Period',
  service: 'Service',
  span: 'Dates',
  hoursShort: 'Hrs',
  rate: 'Rate',
  amount: 'Amount',
  totalHours: 'Total hours',
  grandTotal: 'Total due',
  entries: n => `${String(n)} ${n === 1 ? 'entry' : 'entries'}`,
  footer: h => `Created with devtime.app from ${h} of tracked time.`,
}
const DE: Labels = {
  title: 'Rechnung',
  issuer: 'Softwareentwicklung',
  billTo: 'Rechnung an',
  noClient: 'Workspace',
  number: 'Nr.',
  date: 'Datum',
  period: 'Zeitraum',
  service: 'Leistung',
  span: 'Datum',
  hoursShort: 'Std.',
  rate: 'Satz',
  amount: 'Betrag',
  totalHours: 'Gesamtstunden',
  grandTotal: 'Gesamtbetrag',
  entries: n => `${String(n)} ${n === 1 ? 'Eintrag' : 'Einträge'}`,
  footer: h => `Erstellt mit devtime.app aus ${h} erfassten Stunden.`,
}
