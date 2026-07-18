import { describe, expect, it } from 'vitest'
import { reportsToCsv } from './exportCsv.js'
import type { ReportsData } from '../hooks/useReports'

/**
 * The client seam only *maps* the live `ReportsData` onto the deterministic `reportToCsv` core
 * (REQ-045) — the bytes are the core's. We pin that the mapping carries every field through
 * (project `spentMs` → tracked hours, budget `consumed` → the money column) so the export can never
 * silently drop a section.
 */
const data: ReportsData = {
  totalMs: 9_000_000,
  billableMs: 7_200_000,
  billableMinor: 12_345,
  currencyCode: 'EUR',
  overtimeMs: 0,
  byProject: [{ id: 'p1', name: 'Finanzo', spentMs: 5_400_000, daily: [] }],
  budgets: [
    { id: 'b1', name: 'Q3', ratio: 0.5, consumed: 50_000, basis: 'fee', currencyCode: 'EUR' },
  ],
}

describe('reportsToCsv', () => {
  it('MapsLiveReportsDataOntoTheCore', () => {
    const csv = reportsToCsv('week', data)
    expect(csv).toContain('myDevTime analytics,week')
    expect(csv).toContain('Billable (EUR),123.45')
    expect(csv).toContain('Finanzo,1.50')
    expect(csv).toContain('Q3,500.00,EUR,50%')
  })

  it('EmptyData_ExportsHeadersOnly', () => {
    const csv = reportsToCsv('month', {
      totalMs: 0,
      billableMs: 0,
      billableMinor: 0,
      currencyCode: 'USD',
      overtimeMs: 0,
      byProject: [],
      budgets: [],
    })
    expect(csv).toContain('Project,Tracked (h)')
    expect(csv).not.toContain('Finanzo')
  })
})
