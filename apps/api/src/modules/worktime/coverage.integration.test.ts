import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { HOUR_MS } from '@mydevtime/domain'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { attendanceShifts, projects, timeEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as worktime from './service.js'

/**
 * Project-coverage reconciliation against a REAL Postgres (SKILL §3.3, #149):
 * a day's completed shifts are reconciled against the completed project entries
 * overlapping the window; the uncovered gap is worked-but-unbooked time. Covers
 * the coverage math end-to-end, workspace isolation, and the auth guard. Skips
 * without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('worktime coverage (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-coverage-a'
  const idB = 'itest-coverage-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'coverage-a@itest.local'],
      [idB, 'coverage-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    const ws = [wsA, wsB]
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, ws))
    await db.delete(attendanceShifts).where(inArray(attendanceShifts.workspaceId, ws))
    await db.delete(projects).where(inArray(projects.workspaceId, ws))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)
  const window = { from: d('2026-07-06T00:00:00Z'), to: d('2026-07-07T00:00:00Z') }

  async function seedProject(workspaceId: string): Promise<string> {
    const rows = await db.insert(projects).values({ workspaceId, name: 'Finanzo' }).returning()
    const row = rows[0]
    if (row === undefined) throw new Error('project insert returned no row')
    return row.id
  }

  it('ReconcilesBookedProjectTimeAgainstTheWorkedShift', async () => {
    const projectId = await seedProject(wsA)
    // On the clock 08:00–16:00 (8h, no break).
    await worktime.createShift(db, wsA, idA, {
      startedAt: d('2026-07-06T08:00:00Z'),
      endedAt: d('2026-07-06T16:00:00Z'),
      breakMs: 0,
    })
    // Only 08:00–12:00 booked to a project (4h) → 4h uncovered.
    await db.insert(timeEntries).values({
      workspaceId: wsA,
      userId: idA,
      projectId,
      startedAt: d('2026-07-06T08:00:00Z'),
      endedAt: d('2026-07-06T12:00:00Z'),
      source: 'timer',
    })
    // A running entry (no end) and an entry without a project must not count.
    await db.insert(timeEntries).values({
      workspaceId: wsA,
      userId: idA,
      projectId,
      startedAt: d('2026-07-06T13:00:00Z'),
      endedAt: null,
      source: 'timer',
    })
    await db.insert(timeEntries).values({
      workspaceId: wsA,
      userId: idA,
      projectId: null,
      startedAt: d('2026-07-06T14:00:00Z'),
      endedAt: d('2026-07-06T15:00:00Z'),
      source: 'manual',
    })

    const cov = await worktime.worktimeCoverage(db, wsA, window)
    expect(cov.workedSpanMs).toBe(8 * HOUR_MS)
    expect(cov.bookedWithinMs).toBe(4 * HOUR_MS)
    expect(cov.uncoveredMs).toBe(4 * HOUR_MS)
    expect(cov.bookedOutsideMs).toBe(0)
    expect(cov.coverageRatio).toBeCloseTo(0.5, 10)
  })

  it('IsScopedToTheWorkspace', async () => {
    const projectId = await seedProject(wsA)
    await worktime.createShift(db, wsA, idA, {
      startedAt: d('2026-07-06T08:00:00Z'),
      endedAt: d('2026-07-06T16:00:00Z'),
      breakMs: 0,
    })
    await db.insert(timeEntries).values({
      workspaceId: wsA,
      userId: idA,
      projectId,
      startedAt: d('2026-07-06T08:00:00Z'),
      endedAt: d('2026-07-06T12:00:00Z'),
      source: 'timer',
    })
    // Workspace B sees none of A's shifts or entries.
    const b = await worktime.worktimeCoverage(db, wsB, window)
    expect(b.workedSpanMs).toBe(0)
    expect(b.bookedWithinMs).toBe(0)
    expect(b.uncoveredMs).toBe(0)
    expect(b.coverageRatio).toBe(0)
  })

  it('GetCoverage_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/worktime/coverage?from=2026-07-06T00:00:00Z&to=2026-07-07T00:00:00Z',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
