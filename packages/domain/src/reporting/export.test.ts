import { describe, expect, it } from 'vitest'
import { reportToCsv, type ReportExportInput } from './export.js'

/**
 * The Reports export is deterministic CSV (REQ-045, ADR-0005): same view-model → byte-identical
 * document. We pin the formatting (hours/money to 2dp, utilization as integer percent), the RFC 4180
 * escaping (a comma/quote in a name never breaks a column), the signed overtime, and the honest
 * empty export (headers, no data rows).
 */
const base: ReportExportInput = {
  range: 'week',
  totalMs: 9_000_000, // 2.50 h
  billableMs: 7_200_000, // 2.00 h
  billableMinor: 12_345, // 123.45
  currencyCode: 'EUR',
  overtimeMs: -1_800_000, // −0.50 h
  projects: [
    { name: 'Finanzo', trackedMs: 5_400_000 }, // 1.50
    { name: 'Acme, Inc.', trackedMs: 3_600_000 }, // 1.00
  ],
  budgets: [{ name: 'Q3', consumedMinor: 50_000, ratio: 0.732, currencyCode: 'EUR' }],
}

describe('reportToCsv', () => {
  it('FullReport_FormatsEverySectionAndFigure', () => {
    const csv = reportToCsv(base)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Report,Range')
    expect(lines[1]).toBe('myDevTime analytics,week')
    expect(csv).toContain('Total tracked (h),2.50')
    expect(csv).toContain('Billable tracked (h),2.00')
    expect(csv).toContain('Billable (EUR),123.45')
    expect(csv).toContain('Overtime balance (h),-0.50')
    expect(csv).toContain('Finanzo,1.50')
    expect(csv).toContain('Q3,500.00,EUR,73%')
  })

  it('NameWithComma_IsQuotedPerRfc4180', () => {
    const csv = reportToCsv(base)
    expect(csv).toContain('"Acme, Inc.",1.00')
  })

  it('NameWithQuote_DoublesTheQuote', () => {
    const csv = reportToCsv({
      ...base,
      projects: [{ name: 'The "Big" One', trackedMs: 3_600_000 }],
    })
    expect(csv).toContain('"The ""Big"" One",1.00')
  })

  it('EmptyReport_ExportsHeadersWithNoDataRows', () => {
    const csv = reportToCsv({
      range: 'month',
      totalMs: 0,
      billableMs: 0,
      billableMinor: 0,
      currencyCode: 'USD',
      overtimeMs: 0,
      projects: [],
      budgets: [],
    })
    expect(csv).toContain('Project,Tracked (h)')
    expect(csv).toContain('Budget,Consumed,Currency,Utilization')
    expect(csv).toContain('Total tracked (h),0.00')
    // No project/budget data rows beyond the headers.
    expect(csv).not.toContain('Finanzo')
  })

  it('Deterministic_SameInputSameBytes', () => {
    expect(reportToCsv(base)).toBe(reportToCsv(base))
  })
})
