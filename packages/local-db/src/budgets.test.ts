import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import { createBudget, listBudgets } from './budgets.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('budgets repository', () => {
  it('CreateBudget_RoundTrips_WithDefaultThresholds', async () => {
    const db = await openTestDb()
    await createBudget(db, WS, {
      scope: 'project',
      scopeId: 'p1',
      basis: 'money',
      limitAmount: 100000,
      period: 'total',
    })
    const [b] = await listBudgets(db, WS)
    expect(b?.scope).toBe('project')
    expect(b?.scopeId).toBe('p1')
    expect(b?.basis).toBe('money')
    expect(b?.limitAmount).toBe(100000)
    expect(b?.thresholds).toEqual([0.8, 1])
  })

  it('CreateBudget_KeepsCustomThresholds', async () => {
    const db = await openTestDb()
    await createBudget(db, WS, {
      scope: 'project',
      scopeId: 'p1',
      basis: 'hours',
      limitAmount: 36000000,
      period: 'monthlyRecurring',
      thresholds: [0.5, 0.9, 1.2],
    })
    const [b] = await listBudgets(db, WS)
    expect(b?.thresholds).toEqual([0.5, 0.9, 1.2])
    expect(b?.basis).toBe('hours')
    expect(b?.period).toBe('monthlyRecurring')
  })

  it('Budgets_AreWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await createBudget(db, WS, {
      scope: 'project',
      scopeId: 'p1',
      basis: 'money',
      limitAmount: 100000,
      period: 'total',
    })
    expect(await listBudgets(db, OTHER)).toHaveLength(0)
  })
})
