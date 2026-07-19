import PDFDocument from 'pdfkit'
import type { ReportExportInput } from '@mydevtime/domain'

/**
 * Reports/analytics PDF serializer (REQ-045, ADR-0020) — the sole PDFKit adapter for the analytics
 * export; the vendor type never leaves this file (§2.2). It renders the deterministic Reports
 * view-model (`ReportExportInput`, the same shape `reportToCsv` serialises) as a client-presentable
 * document: a summary metric block, the per-project tracked-time breakdown and the budgets block.
 * Like the timesheet PDF it *only formats* — every figure is already the deterministic core's, this
 * never re-computes one (ADR-0005). Numbers are formatted here (hours/money to 2dp, utilization as an
 * integer percent) exactly as the CSV, so the two renditions agree. The creation date is pinned so
 * the same view-model yields byte-identical output, not clock-dependent bytes. Distinct from the
 * timesheet/invoice PDF (REQ-009): that renders billable line items for signing, this the dashboard.
 */

const MS_PER_HOUR = 3_600_000

/** Milliseconds → hours with two decimals (deterministic; no locale, no `Intl`). */
function hours(ms: number): string {
  return (ms / MS_PER_HOUR).toFixed(2)
}

/** Minor currency units → a plain decimal amount with two places (deterministic). */
function amount(minor: number): string {
  return (minor / 100).toFixed(2)
}

/** A ratio (0–1+) → an integer percent (deterministic rounding). */
function percent(ratio: number): string {
  return `${String(Math.round(ratio * 100))}%`
}

interface Column {
  readonly x: number
  readonly width: number
  readonly align: 'left' | 'right'
}

const BOTTOM = 780 // A4 height 842 − bottom margin

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

/**
 * Render the Reports view-model to a PDF `Buffer`. `generatedAt` pins the document's creation date
 * for reproducibility (defaults to the epoch, matching the timesheet PDF's reproducible default), so
 * the same input always produces the same bytes.
 */
export function reportToPdf(
  input: ReportExportInput,
  opts: { readonly generatedAt?: Date } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `myDevTime analytics — ${input.range}`,
        Author: 'myDevTime',
        CreationDate: opts.generatedAt ?? new Date(0),
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    doc.on('error', reject)

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111').text('myDevTime', 50, 50)
    doc.font('Helvetica').fontSize(11).fillColor('#888').text(`Analytics report — ${input.range}`)
    doc.fillColor('#111').moveDown(1)

    // Summary metrics
    doc.font('Helvetica-Bold').fontSize(12).text('Summary')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10)
    const metric = (label: string, value: string): void => {
      const y = doc.y
      cell(doc, label, { x: 50, width: 300, align: 'left' }, y)
      cell(doc, value, { x: 350, width: 195, align: 'right' }, y)
      doc.moveDown(0.6)
    }
    metric('Total tracked (h)', hours(input.totalMs))
    metric('Billable tracked (h)', hours(input.billableMs))
    metric(`Billable (${input.currencyCode})`, amount(input.billableMinor))
    metric('Overtime balance (h)', hours(input.overtimeMs))
    doc.moveDown(0.6)

    // Per-project tracked time
    doc.font('Helvetica-Bold').fontSize(12).text('Tracked time by project')
    doc.moveDown(0.3)
    let y = doc.y
    doc.font('Helvetica-Bold').fontSize(9)
    cell(doc, 'Project', { x: 50, width: 350, align: 'left' }, y)
    cell(doc, 'Tracked (h)', { x: 400, width: 145, align: 'right' }, y)
    y += 14
    rule(doc, y - 3)
    doc.font('Helvetica').fontSize(9)
    if (input.projects.length === 0) {
      doc.fillColor('#888').text('No time tracked in this period.', 50, y)
      doc.fillColor('#111')
      y += 14
    } else {
      for (const p of input.projects) {
        if (y > BOTTOM) {
          doc.addPage()
          y = 50
        }
        cell(doc, p.name, { x: 50, width: 350, align: 'left' }, y)
        cell(doc, hours(p.trackedMs), { x: 400, width: 145, align: 'right' }, y)
        y += 14
      }
    }
    doc.y = y
    doc.moveDown(1)

    // Budgets
    doc.font('Helvetica-Bold').fontSize(12).text('Budgets')
    doc.moveDown(0.3)
    y = doc.y
    doc.font('Helvetica-Bold').fontSize(9)
    cell(doc, 'Budget', { x: 50, width: 235, align: 'left' }, y)
    cell(doc, 'Consumed', { x: 285, width: 110, align: 'right' }, y)
    cell(doc, 'Currency', { x: 400, width: 70, align: 'right' }, y)
    cell(doc, 'Used', { x: 475, width: 70, align: 'right' }, y)
    y += 14
    rule(doc, y - 3)
    doc.font('Helvetica').fontSize(9)
    if (input.budgets.length === 0) {
      doc.fillColor('#888').text('No project budgets set.', 50, y)
      doc.fillColor('#111')
    } else {
      for (const b of input.budgets) {
        if (y > BOTTOM) {
          doc.addPage()
          y = 50
        }
        cell(doc, b.name, { x: 50, width: 235, align: 'left' }, y)
        cell(doc, amount(b.consumedMinor), { x: 285, width: 110, align: 'right' }, y)
        cell(doc, b.currencyCode, { x: 400, width: 70, align: 'right' }, y)
        cell(doc, percent(b.ratio), { x: 475, width: 70, align: 'right' }, y)
        y += 14
      }
    }

    doc.end()
  })
}
