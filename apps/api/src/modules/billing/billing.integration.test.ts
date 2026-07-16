import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { createProject } from '../tracking/service.js'
import { createManualEntry } from '../tracking/entries-service.js'
import * as billing from './service.js'

/**
 * The money layer against a REAL Postgres (SKILL §3.3). Covers REQ-005's
 * acceptance-critical behaviour: rate precedence + effective dating through the
 * cost computation, budget status, threshold firing with persisted hysteresis,
 * and workspace isolation. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('billing (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-bill-a'
  const idB = 'itest-bill-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'bill-a@itest.local'],
      [idB, 'bill-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)

  /** A project in wsA with one `hours`-long completed entry starting at `start`. */
  async function projectWithEntry(start: string, hours: number): Promise<string> {
    const project = await createProject(db, wsA, { name: `P-${start}` })
    const startedAt = d(start)
    const endedAt = new Date(startedAt.getTime() + hours * 3_600_000)
    await createManualEntry(db, wsA, idA, { startedAt, endedAt, projectId: project.id })
    return project.id
  }

  it('ProjectCost_MoreSpecificRate_WinsAndIsEffectiveDated', async () => {
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 1)
    await billing.createRate(db, wsA, {
      level: 'workspace',
      amountMinorPerHour: 6000,
      effectiveFrom: d('2020-01-01'),
    })
    const base = await billing.projectCost(db, wsA, projectId, new Date())
    expect(base.costMinor).toBe(6000)
    expect(base.currencyCode).toBe('EUR')

    // A project-level rate is more specific → it now prices the entry.
    await billing.createRate(db, wsA, {
      level: 'project',
      scopeId: projectId,
      amountMinorPerHour: 9000,
      effectiveFrom: d('2026-01-01'),
    })
    expect((await billing.projectCost(db, wsA, projectId, new Date())).costMinor).toBe(9000)
  })

  it('ProjectCost_FutureDatedRate_DoesNotApplyRetroactively', async () => {
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 2)
    await billing.createRate(db, wsA, {
      level: 'project',
      scopeId: projectId,
      amountMinorPerHour: 5000,
      effectiveFrom: d('2020-01-01'),
    })
    // A raise dated in the future must not touch the June entry.
    await billing.createRate(db, wsA, {
      level: 'project',
      scopeId: projectId,
      amountMinorPerHour: 8000,
      effectiveFrom: d('2027-01-01'),
    })
    expect((await billing.projectCost(db, wsA, projectId, new Date())).costMinor).toBe(2 * 5000)
  })

  it('BudgetStatus_MoneyBasis_ComputesRatioFromCost', async () => {
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 1)
    await billing.createRate(db, wsA, {
      level: 'project',
      scopeId: projectId,
      amountMinorPerHour: 8000,
      effectiveFrom: d('2020-01-01'),
    })
    const budget = await billing.createBudget(db, wsA, {
      scope: 'project',
      scopeId: projectId,
      basis: 'money',
      limitAmount: 10000,
      period: 'total',
      thresholds: [0.8, 1],
    })
    const { status } = await billing.budgetStatusFor(db, wsA, budget.id, new Date())
    expect(status.consumed).toBe(8000)
    expect(status.ratio).toBeCloseTo(0.8)
    expect(status.reached).toEqual([0.8])
  })

  it('BudgetBurndown_SamplesCumulativeConsumptionAcrossTheWindow', async () => {
    // One 2h entry on 2026-06-01; an hours budget. Sampling before→after must climb
    // from 0 to the full 2h, monotonically, and match the as-of status at the end.
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 2)
    const budget = await billing.createBudget(db, wsA, {
      scope: 'project',
      scopeId: projectId,
      basis: 'hours',
      limitAmount: 10 * 3_600_000, // 10h cap
      period: 'total',
      thresholds: [0.8, 1],
    })
    const result = await billing.budgetBurndownFor(db, wsA, budget.id, {
      from: d('2026-05-01T00:00:00Z'),
      to: d('2026-07-01T00:00:00Z'),
      points: 5,
    })
    const consumed = result.points.map(p => p.consumed)
    expect(consumed).toHaveLength(5)
    // Non-decreasing cumulative curve.
    for (let i = 1; i < consumed.length; i += 1) {
      expect(consumed[i]!).toBeGreaterThanOrEqual(consumed[i - 1]!)
    }
    // First sample predates the entry (0), the last includes the full 2h.
    expect(consumed[0]).toBe(0)
    expect(consumed[consumed.length - 1]).toBe(2 * 3_600_000)
    // The final point matches the as-of status consumption exactly.
    const status = await billing.budgetStatusFor(db, wsA, budget.id, d('2026-07-01T00:00:00Z'))
    expect(consumed[consumed.length - 1]).toBe(status.status.consumed)
  })

  it('BudgetBurndown_IsWorkspaceIsolated', async () => {
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 1)
    const budget = await billing.createBudget(db, wsA, {
      scope: 'project',
      scopeId: projectId,
      basis: 'hours',
      limitAmount: 3_600_000,
      period: 'total',
      thresholds: [1],
    })
    // Workspace B must not be able to read A's budget burn-down.
    await expect(
      billing.budgetBurndownFor(db, wsB, budget.id, {
        from: d('2026-05-01T00:00:00Z'),
        to: d('2026-07-01T00:00:00Z'),
        points: 3,
      }),
    ).rejects.toThrow()
  })

  it('EvaluateBudget_CrossesThreshold_FiresOnceThenHoldsViaHysteresis', async () => {
    const projectId = await projectWithEntry('2026-06-01T09:00:00Z', 1)
    await billing.createRate(db, wsA, {
      level: 'project',
      scopeId: projectId,
      amountMinorPerHour: 9000,
      effectiveFrom: d('2020-01-01'),
    })
    const budget = await billing.createBudget(db, wsA, {
      scope: 'project',
      scopeId: projectId,
      basis: 'money',
      limitAmount: 10000,
      period: 'total',
      thresholds: [0.8, 1],
    })
    const first = await billing.evaluateBudget(db, wsA, budget.id, new Date())
    expect(first.evaluation.toFire).toEqual([0.8]) // 9000/10000 = 0.9
    expect(first.evaluation.fired).toEqual([0.8])

    // Re-evaluating with no change must not re-fire (persisted hysteresis).
    const second = await billing.evaluateBudget(db, wsA, budget.id, new Date())
    expect(second.evaluation.toFire).toEqual([])
    expect(second.budget.firedThresholds).toEqual([0.8])
  })

  it('Rate_CrossWorkspaceAccess_IsDenied', async () => {
    const rate = await billing.createRate(db, wsA, {
      level: 'workspace',
      amountMinorPerHour: 5000,
      effectiveFrom: d('2020-01-01'),
    })
    expect((await billing.listRates(db, wsB)).some(r => r.id === rate.id)).toBe(false)
    await expect(billing.deleteRate(db, wsB, rate.id)).rejects.toThrow(/not found/)
  })

  it('GetRates_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/billing/rates' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
