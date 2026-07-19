import { describe, expect, it } from 'vitest'
import type { ReportExportInput } from '@mydevtime/domain'
import { reportToPdf } from './reports-pdf.js'

/**
 * The Reports/analytics PDF adapter (REQ-045, ADR-0020). It only *formats* the deterministic
 * view-model into a PDF, so the acceptance-critical properties are: it emits a valid PDF document,
 * it never crashes on the empty report (honest headers, no fabricated rows), and — with the creation
 * date pinned — the same view-model yields byte-identical output. Runs without a database.
 */
const base: ReportExportInput = {
  range: 'week',
  totalMs: 9_000_000, // 2.50 h
  billableMs: 7_200_000, // 2.00 h
  billableMinor: 12_345, // 123.45
  currencyCode: 'EUR',
  overtimeMs: -1_800_000, // −0.50 h
  projects: [
    { name: 'Finanzo', trackedMs: 5_400_000 },
    { name: 'Acme, Inc.', trackedMs: 3_600_000 },
  ],
  budgets: [{ name: 'Q3', consumedMinor: 50_000, ratio: 0.732, currencyCode: 'EUR' }],
}

describe('reportToPdf', () => {
  it('FullReport_EmitsAValidPdfDocument', async () => {
    const buffer = await reportToPdf(base)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(500)
  })

  it('EmptyReport_RendersWithoutFabricatingRows', async () => {
    const buffer = await reportToPdf({
      range: 'month',
      totalMs: 0,
      billableMs: 0,
      billableMinor: 0,
      currencyCode: 'USD',
      overtimeMs: 0,
      projects: [],
      budgets: [],
    })

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(500)
  })

  it('PinnedGeneratedAt_SameInputSameBytes', async () => {
    const at = new Date('2026-07-06T00:00:00Z')

    const first = await reportToPdf(base, { generatedAt: at })
    const second = await reportToPdf(base, { generatedAt: at })

    expect(first.equals(second)).toBe(true)
  })
})
