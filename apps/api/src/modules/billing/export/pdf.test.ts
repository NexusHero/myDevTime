import { describe, expect, it } from 'vitest'
import { PDFParse } from 'pdf-parse'
import { buildTimesheet, type TimesheetEntryInput } from '@mydevtime/domain'
import { timesheetToPdf } from './pdf.js'
import { moneyMajor } from './format.js'
import type { TimesheetMeta } from './timesheet-source.js'

/**
 * PDF export (REQ-009). Text is extracted and asserted — the document shows the
 * parties, the rounding profile, and a total that equals the deterministic
 * aggregate to the cent. The layout only formats; it never re-computes.
 */
const HOUR = 3_600_000

async function extract(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const res = await parser.getText()
    return { text: res.text, pages: res.total }
  } finally {
    await parser.destroy()
  }
}

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
// 2.5 h at 90.00/h → 225.00 (22500 minor)
const timesheet = buildTimesheet(entries, {
  rounding: { mode: 'nearest', incrementMinutes: 15 },
  currency: 'EUR',
})

describe('timesheet PDF export', () => {
  it('Pdf_En_ShowsPartiesRoundingAndAggregateTotal', async () => {
    const { text } = await extract(await timesheetToPdf(timesheet, meta, 'en'))
    expect(text).toContain('Acme GmbH')
    expect(text).toContain('Website Relaunch')
    expect(text).toContain('Globex')
    expect(text).toContain('nearest / 15 min')
    expect(text).toContain('Timesheet')
    // English format of the aggregate total (no grouping below 1000 → == moneyMajor).
    expect(text).toContain(moneyMajor(timesheet.totalAmountMinor)) // "225.00"
  })

  it('Pdf_De_LocalisesLabelsAndAmounts', async () => {
    const { text } = await extract(await timesheetToPdf(timesheet, meta, 'de'))
    expect(text).toContain('Leistungsnachweis')
    expect(text).toContain('Summe')
    expect(text).toContain('225,00') // German decimal comma
  })

  it('Pdf_ManyRows_PaginatesWithoutLosingTheTotal', async () => {
    const many = buildTimesheet(
      Array.from({ length: 80 }, (_, i) => ({
        durationMs: HOUR,
        rateMinorPerHour: 600, // 6.00/h → total 480.00, no locale grouping to worry about
        billable: true,
        groupKey: `e${String(i).padStart(3, '0')}`,
        groupLabel: '2026-06-02',
        note: `task ${String(i)}`,
      })),
      { rounding: { mode: 'none', incrementMinutes: 1 }, currency: 'EUR' },
    )
    const { text, pages } = await extract(await timesheetToPdf(many, meta, 'en'))
    expect(pages).toBeGreaterThan(1)
    expect(text).toContain(moneyMajor(many.totalAmountMinor)) // 80 h × 6.00 = 480.00
  })
})
