import { describe, expect, it } from 'vitest'
import type { Client } from '../screens/projectsData.js'
import { buildClientRevenueRows } from './revenueBudget.js'

const H = 3_600_000

function client(id: string, name: string, projectIds: string[]): Client {
  return {
    id,
    name,
    projects: projectIds.map(pid => ({
      id: pid,
      name: pid,
      budgetMs: 0,
      spentMs: 0,
      rateMinorPerHour: 0,
      currency: 'EUR',
      tasks: [],
    })),
  }
}

describe('buildClientRevenueRows', () => {
  it('RollsTimeAndRevenueUpToClients_WithShareAndEffectiveRate', () => {
    const catalog = [client('c1', 'Finanzo AG', ['p1', 'p2']), client('c2', 'Nordwind', ['p3'])]
    const timeByProject = [
      { projectId: 'p1', spentMs: 2 * H, billableMs: 2 * H },
      { projectId: 'p2', spentMs: 2 * H, billableMs: 1 * H }, // half billable
      { projectId: 'p3', spentMs: 1 * H, billableMs: 1 * H },
    ]
    const costByProject = [
      { projectId: 'p1', costMinor: 20_000 },
      { projectId: 'p2', costMinor: 4_000 },
      { projectId: 'p3', costMinor: 8_000 },
    ]
    const rows = buildClientRevenueRows(catalog, timeByProject, costByProject)

    // Finanzo: revenue 24 000, spent 4h, billable 3h → 75% share, 8 000 minor/h effective.
    expect(rows[0]).toEqual({
      clientId: 'c1',
      name: 'Finanzo AG',
      revenueMinor: 24_000,
      spentMs: 4 * H,
      billableMs: 3 * H,
      billablePct: 75,
      effectiveRateMinorPerHour: 8_000,
    })
    // Nordwind sorts after (less revenue).
    expect(rows[1]?.clientId).toBe('c2')
    expect(rows[1]?.effectiveRateMinorPerHour).toBe(8_000)
  })

  it('OmitsClientsWithNoActivityInTheWindow', () => {
    const catalog = [client('c1', 'Active', ['p1']), client('c2', 'Idle', ['p2'])]
    const rows = buildClientRevenueRows(
      catalog,
      [{ projectId: 'p1', spentMs: H, billableMs: 0 }],
      [],
    )
    expect(rows.map(r => r.clientId)).toEqual(['c1'])
    expect(rows[0]?.billablePct).toBe(0)
    expect(rows[0]?.effectiveRateMinorPerHour).toBeNull() // no billable time → no rate
  })
})
