import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS, buildMonthlyStatement, zonedTimeToInstant } from '@mydevtime/domain'
import { monthlyStatementToPdf } from './statement-pdf.js'
import type { ReportMeta } from './source.js'

/**
 * The monthly-statement serializer renders the deterministic `MonthlyStatement` to a
 * signable one-month-per-page PDF (REQ-052, design v13 X). Pure (no DB): build a small
 * statement and assert a well-formed, non-empty PDF. Every figure is the domain core's.
 */
const TZ = 'Europe/Berlin'
const at = (d: number, h: number, m = 0): number =>
  zonedTimeToInstant({ year: 2026, month: 7, day: d, hour: h, minute: m, second: 0 }, TZ)

const statement = buildMonthlyStatement({
  year: 2026,
  month: 7,
  tz: TZ,
  shifts: [{ start: at(6, 8), end: at(6, 17), breakMs: 30 * MINUTE_MS }],
  target: [8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 0, 0],
  absences: [{ kind: 'vacation', startDate: '2026-07-07', endDate: '2026-07-07', halfDay: false }],
  breakPreset: [],
  carryoverMs: 5 * HOUR_MS,
})
const meta: ReportMeta = {
  workspaceName: 'Acme GmbH',
  tz: TZ,
  monthLabel: '2026-07',
  from: statement.from,
  to: statement.to,
}

describe('monthlyStatementToPdf', () => {
  it('EmitsANonEmptyPdf', async () => {
    const buf = await monthlyStatementToPdf(statement, meta, 'de')
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('RendersInEnglishToo', async () => {
    const buf = await monthlyStatementToPdf(statement, meta, 'en')
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
