import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { plans, protectedTimes, workspaces } from '../../db/schema.js'
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
    await db.delete(protectedTimes).where(inArray(protectedTimes.workspaceId, [wsA, wsB]))
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

  it('GetPlanById_IsWorkspaceScopedAndReconstructsTheDayPlan', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    const row = await svc.getPlanById(db, wsA, created.id)
    const day = svc.planRowToDayPlan(row)
    expect(day.blocks).toEqual(created.blocks)
    // Workspace B cannot read A's plan.
    await expect(svc.getPlanById(db, wsB, created.id)).rejects.toThrow(/not found/)
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

  it('LabelPlan_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/planner/plans/00000000-0000-0000-0000-000000000000/label',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('ReviewPlan_WithNoTrackedTime_ReportsTheFullPlanAsUndershot', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    const review = await svc.reviewPlan(db, wsA, created.id)
    // No entries tracked → trackedFocusMin 0, drift = -plannedFocusMin.
    expect(review.plannedFocusMin).toBe(created.plannedFocusMin)
    expect(review.trackedFocusMin).toBe(0)
    expect(review.driftMin).toBe(-created.plannedFocusMin)
  })

  it('ReviewPlan_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/planner/plans/00000000-0000-0000-0000-000000000000/review',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  // ─── The plan-apply seam (ADR-0071 P4, REQ-070) ─────────────────────────────────────────

  it('Apply_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    for (const [method, url] of [
      ['POST', '/api/planner/apply'],
      ['GET', '/api/planner/protected?day=2026-07-10'],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        ...(method === 'POST'
          ? {
              payload: {
                proposal: { kind: 'protect-time', day: '2026-07-10', startMin: 0, endMin: 60 },
              },
            }
          : {}),
      })
      expect(res.statusCode).toBe(401)
    }
    await app.close()
  })

  it('AddProtectedTime_IsIdempotentPerExactWindow', async () => {
    const window = { day: '2026-07-11', startMin: 8 * 60, endMin: 12 * 60 }
    await svc.addProtectedTime(db, wsA, idA, window)
    await svc.addProtectedTime(db, wsA, idA, window) // a repeated confirm cannot stack shields
    const listed = await svc.protectedTimesFor(db, wsA, idA, '2026-07-11')
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ ...window, source: 'sevi-proposal' })
  })

  it('ProtectedTimes_AreWorkspaceIsolated', async () => {
    await svc.addProtectedTime(db, wsA, idA, { day: '2026-07-11', startMin: 540, endMin: 600 })
    expect(await svc.protectedTimesFor(db, wsB, idB, '2026-07-11')).toEqual([])
  })

  it('ApplyBlockMutation_MoveWritesANewAcceptedVersionWithTheMutatedBlocks', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    const focusIndex = created.blocks.findIndex(b => b.kind === 'focus')
    const before = created.blocks[focusIndex]!
    const next = await svc.applyBlockMutation(db, wsA, idA, created.id, {
      kind: 'move-block',
      blockId: String(focusIndex),
      toStartMin: 6 * 60,
    })
    expect(next.version).toBe(created.version + 1)
    expect(next.status).toBe('accepted')
    // Duration preserved (whatever length the core laid out), moved to the front of the
    // (re-sorted) day — the assertion pins the MUTATION, never the generator's layout.
    const moved = next.blocks[0]
    expect(moved).toMatchObject({ kind: 'focus', startMin: 6 * 60, lenMin: before.lenMin })
    // The pre-apply version is untouched in the history.
    const original = await svc.getPlanById(db, wsA, created.id)
    expect(original.blocks).toEqual(created.blocks)
  })

  it('ApplyBlockMutation_ShrinkClampsToTheFloorAndRecomputesFocus', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    const focusIndex = created.blocks.findIndex(b => b.kind === 'focus')
    const next = await svc.applyBlockMutation(db, wsA, idA, created.id, {
      kind: 'shrink-block',
      blockId: String(focusIndex),
      byMin: 500, // far past the block → clamps to the 15-min floor
    })
    const shrunk = next.blocks.find(b => b.kind === 'focus')
    expect(shrunk?.lenMin).toBe(15)
    expect(next.plannedFocusMin).toBe(
      next.blocks.filter(b => b.kind === 'focus').reduce((s, b) => s + b.lenMin, 0),
    )
  })

  it('ApplyBlockMutation_ForeignPlanId_ReadsAsNotFound', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    await expect(
      svc.applyBlockMutation(db, wsB, idB, created.id, {
        kind: 'move-block',
        blockId: '0',
        toStartMin: 0,
      }),
    ).rejects.toThrow(/not found/)
  })

  it('ApplyBlockMutation_UnknownBlockId_IsAnHonest400', async () => {
    const created = await svc.generatePlan(db, wsA, idA, input)
    await expect(
      svc.applyBlockMutation(db, wsA, idA, created.id, {
        kind: 'move-block',
        blockId: '99',
        toStartMin: 0,
      }),
    ).rejects.toThrow(/no block/)
  })
})
