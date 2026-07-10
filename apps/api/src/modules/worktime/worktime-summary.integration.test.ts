import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { HOUR_MS, MINUTE_MS } from '@mydevtime/domain'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { attendanceShifts, workSchedules, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as worktime from './service.js'

/**
 * The overtime balance against a REAL Postgres (SKILL §3.3): completed shifts
 * starting in the window are netted (minus breaks) and measured against the
 * schedule in effect at the window. Covers the balance math end-to-end, workspace
 * isolation, and the auth guard. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('worktime summary (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-worktime-a'
  const idB = 'itest-worktime-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'worktime-a@itest.local'],
      [idB, 'worktime-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    const ws = [wsA, wsB]
    await db.delete(attendanceShifts).where(inArray(attendanceShifts.workspaceId, ws))
    await db.delete(workSchedules).where(inArray(workSchedules.workspaceId, ws))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)
  // 2026-07-06 Mon .. 2026-07-13 Mon (UTC week), 8h Mon–Fri target.
  const window = { from: d('2026-07-06T00:00:00Z'), to: d('2026-07-13T00:00:00Z'), tz: 'UTC' }
  const eightToFive = [8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 0, 0]

  it('BalancesNetWorkedAgainstTheActiveSchedule', async () => {
    await worktime.setSchedule(db, wsA, {
      effectiveFrom: d('2026-01-01T00:00:00Z'),
      weeklyTargetMs: eightToFive,
    })
    // Mon–Fri, 9h gross with a 30m break → 8.5h net/day = +2.5h over 40h target.
    for (const day of [6, 7, 8, 9, 10]) {
      await worktime.createShift(db, wsA, idA, {
        startedAt: d(`2026-07-${String(day).padStart(2, '0')}T08:00:00Z`),
        endedAt: d(`2026-07-${String(day).padStart(2, '0')}T17:00:00Z`),
        breakMs: 30 * MINUTE_MS,
      })
    }
    // An open shift (no clock-out) and one before the window must not count.
    await worktime.createShift(db, wsA, idA, {
      startedAt: d('2026-07-01T08:00:00Z'),
      endedAt: d('2026-07-01T17:00:00Z'),
      breakMs: 0,
    })

    const bal = await worktime.worktimeSummary(db, wsA, window)
    expect(bal.workedMs).toBe(5 * (9 * HOUR_MS - 30 * MINUTE_MS))
    expect(bal.targetMs).toBe(40 * HOUR_MS)
    expect(bal.balanceMs).toBe(5 * 30 * MINUTE_MS)
  })

  it('IsScopedToTheWorkspace', async () => {
    await worktime.setSchedule(db, wsA, {
      effectiveFrom: d('2026-01-01T00:00:00Z'),
      weeklyTargetMs: eightToFive,
    })
    await worktime.createShift(db, wsA, idA, {
      startedAt: d('2026-07-06T08:00:00Z'),
      endedAt: d('2026-07-06T16:00:00Z'),
      breakMs: 0,
    })
    // Workspace B has no schedule and no shifts → all zero.
    const b = await worktime.worktimeSummary(db, wsB, window)
    expect(b.workedMs).toBe(0)
    expect(b.targetMs).toBe(0)
    expect(b.balanceMs).toBe(0)
  })

  it('GetSummary_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/worktime/summary?from=2026-07-06T00:00:00Z&to=2026-07-13T00:00:00Z',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
