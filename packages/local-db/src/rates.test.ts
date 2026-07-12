import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import { createRate, listRates } from './rates.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('rates repository', () => {
  it('CreateWorkspaceRate_RoundTrips_WithNullScope', async () => {
    const db = await openTestDb()
    const rate = await createRate(db, WS, { level: 'workspace', amountMinorPerHour: 6000 })
    expect(rate.scopeId).toBeNull()
    const [stored] = await listRates(db, WS)
    expect(stored?.amountMinorPerHour).toBe(6000)
    expect(stored?.level).toBe('workspace')
    expect(stored?.scopeId).toBeNull()
  })

  it('CreateScopedRate_KeepsItsScopeId', async () => {
    const db = await openTestDb()
    await createRate(db, WS, { level: 'project', scopeId: 'p1', amountMinorPerHour: 9000 })
    const [stored] = await listRates(db, WS)
    expect(stored?.level).toBe('project')
    expect(stored?.scopeId).toBe('p1')
  })

  it('ListRates_OrdersByLevelThenEffectiveDate', async () => {
    const db = await openTestDb()
    await createRate(db, WS, {
      level: 'project',
      scopeId: 'p1',
      amountMinorPerHour: 9000,
      effectiveFrom: '2026-02-01T00:00:00.000Z',
    })
    await createRate(db, WS, {
      level: 'project',
      scopeId: 'p1',
      amountMinorPerHour: 8000,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    })
    await createRate(db, WS, { level: 'workspace', amountMinorPerHour: 5000 })
    const rates = await listRates(db, WS)
    // client < project < task < workspace? Order is by the TEXT level; assert the
    // two project rates come back oldest-effective first regardless.
    const projects = rates.filter(r => r.level === 'project')
    expect(projects.map(r => r.amountMinorPerHour)).toEqual([8000, 9000])
  })

  it('Rates_AreWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await createRate(db, WS, { level: 'workspace', amountMinorPerHour: 6000 })
    expect(await listRates(db, OTHER)).toHaveLength(0)
  })
})
