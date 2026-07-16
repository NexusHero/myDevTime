import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { HOUR_MS, MINUTE_MS } from '@mydevtime/domain'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { attendanceShifts, workspaces } from '../../db/schema.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { ValidationError } from '../../errors.js'
import * as worktime from './service.js'

/**
 * The punch clock against a REAL Postgres (SKILL §3.3): clock-in opens a shift,
 * clock-out closes it, and the shifts list annotates each completed shift with its
 * ArbZG §4 break shortfall. Covers the one-open-shift invariant, the break-rule
 * hint, and workspace isolation. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('worktime punch clock (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-punch-a'
  const idB = 'itest-punch-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'punch-a@itest.local'],
      [idB, 'punch-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(attendanceShifts).where(inArray(attendanceShifts.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)

  it('ClockInThenOutOpensAndClosesOneShift', async () => {
    const open = await worktime.clockIn(db, wsA, idA, { startedAt: d('2026-07-06T08:00:00Z') })
    expect(open.endedAt).toBeNull()
    expect(await worktime.getRunningShift(db, wsA)).not.toBeNull()

    const closed = await worktime.clockOut(db, wsA, {
      endedAt: d('2026-07-06T16:30:00Z'),
      breakMs: 30 * MINUTE_MS,
    })
    expect(closed.id).toBe(open.id)
    expect(closed.endedAt).not.toBeNull()
    expect(await worktime.getRunningShift(db, wsA)).toBeNull()
  })

  it('RejectsASecondClockInWhileOpen', async () => {
    await worktime.clockIn(db, wsA, idA, { startedAt: d('2026-07-06T08:00:00Z') })
    await expect(worktime.clockIn(db, wsA, idA)).rejects.toThrow(/already clocked in/)
  })

  it('ConcurrentClockIn_KeepsOneOpenShiftAndMapsTheLoserTo4xx', async () => {
    // Two clock-ins race: both may pass the read-then guard and insert. The partial
    // unique index lets exactly one win; the loser must be a clean ValidationError
    // (→ 400), never a raw unique-violation surfacing as a 500 (audit M9).
    const results = await Promise.allSettled([
      worktime.clockIn(db, wsA, idA, { startedAt: d('2026-07-06T08:00:00Z') }),
      worktime.clockIn(db, wsA, idA, { startedAt: d('2026-07-06T08:00:01Z') }),
    ])

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter(r => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toBeInstanceOf(ValidationError)

    // Exactly one open shift persisted — data integrity holds under the race.
    const open = await db
      .select()
      .from(attendanceShifts)
      .where(and(eq(attendanceShifts.workspaceId, wsA), isNull(attendanceShifts.endedAt)))
    expect(open).toHaveLength(1)
  })

  it('ClockOutWithoutAnOpenShiftThrows', async () => {
    await expect(worktime.clockOut(db, wsA)).rejects.toThrow(/no open shift/)
  })

  it('ListShiftsAnnotatesTheBreakShortfall', async () => {
    // 8h gross with only 10m break → 20m short of the ArbZG §4 30m rule.
    await worktime.createShift(db, wsA, idA, {
      startedAt: d('2026-07-07T08:00:00Z'),
      endedAt: d('2026-07-07T16:00:00Z'),
      breakMs: 10 * MINUTE_MS,
    })
    const shifts = await worktime.listShifts(db, wsA, {
      from: d('2026-07-06T00:00:00Z'),
      to: d('2026-07-13T00:00:00Z'),
    })
    expect(shifts).toHaveLength(1)
    expect(shifts[0]?.breakShortfallMs).toBe(20 * MINUTE_MS)
  })

  it('IsScopedToTheWorkspace', async () => {
    await worktime.clockIn(db, wsA, idA, { startedAt: d('2026-07-06T08:00:00Z') })
    // Workspace B has its own (empty) clock — A's open shift must not leak.
    expect(await worktime.getRunningShift(db, wsB)).toBeNull()
    // And B can clock in independently despite A being open.
    const bOpen = await worktime.clockIn(db, wsB, idB, { startedAt: d('2026-07-06T09:00:00Z') })
    expect(bOpen.endedAt).toBeNull()
    expect(HOUR_MS).toBe(3_600_000)
  })
})
