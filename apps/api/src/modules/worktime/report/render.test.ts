import { describe, expect, it } from 'vitest'
import {
  HOUR_MS,
  MINUTE_MS,
  buildWorktimeReport,
  ARBZG_PRESET,
  zonedTimeToInstant,
} from '@mydevtime/domain'
import { worktimeReportToPdf } from './pdf.js'
import { worktimeReportToXlsx } from './xlsx.js'
import type { ReportMeta } from './source.js'

/**
 * The report serializers render the deterministic `WorktimeReport` to a signable
 * PDF / XLSX (REQ-030). These are pure (no DB): build a small report and assert
 * each serializer emits a well-formed, non-empty document. Byte-for-byte content
 * is the domain core's; here we only prove the vendor adapters produce a file.
 */
const TZ = 'Europe/Berlin'
const at = (d: number, h: number): number =>
  zonedTimeToInstant({ year: 2026, month: 7, day: d, hour: h, minute: 0, second: 0 }, TZ)

const report = buildWorktimeReport({
  from: zonedTimeToInstant({ year: 2026, month: 7, day: 6, hour: 0, minute: 0, second: 0 }, TZ),
  to: zonedTimeToInstant({ year: 2026, month: 7, day: 9, hour: 0, minute: 0, second: 0 }, TZ),
  tz: TZ,
  shifts: [{ start: at(6, 8), end: at(6, 17), breakMs: 10 * MINUTE_MS }], // 8h50 gross, break short
  target: [8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 0, 0],
  absences: [{ kind: 'vacation', startDate: '2026-07-07', endDate: '2026-07-07', halfDay: false }],
  breakPreset: ARBZG_PRESET,
})
const meta: ReportMeta = {
  workspaceName: 'Acme GmbH',
  tz: TZ,
  monthLabel: '2026-07',
  from: report.from,
  to: report.to,
}

describe('worktimeReportToPdf', () => {
  it('EmitsANonEmptyPdf', async () => {
    const buf = await worktimeReportToPdf(report, meta, 'de')
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('worktimeReportToXlsx', () => {
  it('EmitsANonEmptyXlsx', async () => {
    const buf = await worktimeReportToXlsx(report, meta)
    expect(buf.length).toBeGreaterThan(500)
    // XLSX is a ZIP container → starts with the PK magic bytes.
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  })
})
