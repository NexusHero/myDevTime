import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { plans, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as svc from './service.js'

/**
 * The Co-Planner plan entity against a REAL Postgres (SKILL §3.3): generate runs
 * the deterministic core and persists a versioned proposal; a second generate for
 * the same day bumps the version; accept flips the status. Covers versioning,
 * status transitions, workspace isolation, and the auth guard. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('planner (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-plan-a'
  const idB = 'itest-plan-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'plan-a@itest.local'],
      [idB, 'plan-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(plans).where(inArray(plans.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const input = {
    date: '2026-07-10',
    plan: {
      dayStartMin: 8 * 60,
      dayEndMin: 18 * 60,
      anchors: [{ startMin: 9 * 60, lenMin: 30, label: 'Daily' }],
      backlog: [{ id: 't1', label: 'Sync engine', estimateMin: 180, priority: 1 }],
    },
  }

  it('GeneratesAVersionedProposalFromTheCore', async () => {
    const plan = await svc.generatePlan(db, wsA, idA, input)
    expect(plan.version).toBe(1)
    expect(plan.status).toBe('proposed')
    expect(plan.plannedFocusMin).toBe(180)
    expect(plan.blocks.some(b => b.kind === 'meeting')).toBe(true)
    expect(plan.blocks.some(b => b.kind === 'focus' && b.taskId === 't1')).toBe(true)
  })

  it('BumpsTheVersionOnRegenerateAndAccepts', async () => {
    const v1 = await svc.generatePlan(db, wsA, idA, input)
    const v2 = await svc.generatePlan(db, wsA, idA, input)
    expect(v2.version).toBe(2)
    const latest = await svc.getLatestPlan(db, wsA, '2026-07-10')
    expect(latest?.id).toBe(v2.id)

    const accepted = await svc.setPlanStatus(db, wsA, v1.id, 'accepted')
    expect(accepted.status).toBe('accepted')
  })

  it('IsScopedToTheWorkspace', async () => {
    await svc.generatePlan(db, wsA, idA, input)
    expect(await svc.getLatestPlan(db, wsB, '2026-07-10')).toBeNull()
  })

  it('GetPlans_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/planner/plans?date=2026-07-10' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
