import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { HOUR_MS, MINUTE_MS } from '@mydevtime/domain'
import { loadConfig } from '../../../config.js'
import { createDb } from '../../../db/client.js'
import { user } from '../../../db/auth-schema.js'
import { absences, attendanceShifts, workSchedules, workspaces } from '../../../db/schema.js'
import { buildApp } from '../../../app.js'
import { resolveWorkspaceId } from '../../../core/workspace.js'
import * as worktime from '../service.js'
import * as absSvc from '../../absences/service.js'
import { loadWorktimeReport } from './source.js'

/**
 * The monthly work-time report against a REAL Postgres (SKILL §3.3): the loader
 * joins shifts, the active schedule, and absences and builds the deterministic
 * report — worked totals, and absence days credited against the target. Covers the
 * end-to-end assembly and the report route's auth guard. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('worktime report (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const id = 'itest-report-a'
  let ws = ''

  beforeAll(async () => {
    await db.delete(user).where(eq(user.id, id))
    await db
      .insert(user)
      .values({ id, name: 'Acme', email: 'report-a@itest.local', emailVerified: true })
    ws = await resolveWorkspaceId(db, id, 'Acme')
  })

  afterEach(async () => {
    await db.delete(attendanceShifts).where(inArray(attendanceShifts.workspaceId, [ws]))
    await db.delete(workSchedules).where(inArray(workSchedules.workspaceId, [ws]))
    await db.delete(absences).where(inArray(absences.workspaceId, [ws]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws))
    await db.delete(user).where(eq(user.id, id))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)

  it('AssemblesTheMonthWithAbsenceCredit', async () => {
    await worktime.setSchedule(db, ws, {
      effectiveFrom: d('2026-01-01T00:00:00Z'),
      weeklyTargetMs: [8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 8 * HOUR_MS, 0, 0],
    })
    // Mon 2026-07-06, 8h worked, 30m break.
    await worktime.createShift(db, ws, id, {
      startedAt: d('2026-07-06T06:00:00Z'),
      endedAt: d('2026-07-06T14:30:00Z'),
      breakMs: 30 * MINUTE_MS,
    })
    // Tue 2026-07-07 vacation → its target is credited.
    await absSvc.createAbsence(db, ws, id, {
      kind: 'vacation',
      startDate: '2026-07-07',
      endDate: '2026-07-07',
    })

    const { report, meta } = await loadWorktimeReport(db, ws, { year: 2026, month: 7, tz: 'UTC' })
    expect(meta.monthLabel).toBe('2026-07')
    expect(report.days.length).toBe(31)
    expect(report.totalWorkedMs).toBe(8 * HOUR_MS)
    // The Tuesday vacation day is credited its 8h target.
    expect(report.totalCreditedMs).toBe(8 * HOUR_MS)
    expect(report.absenceDaysByKind.vacation).toBe(1)
  })

  it('GetReport_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/worktime/report?year=2026&month=7' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
