import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { absencePolicies, absences, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as svc from './service.js'

/**
 * Absences against a REAL Postgres (SKILL §3.3): leave ranges + the vacation
 * balance, which only counts `vacation` days against the policy. Covers the
 * balance math end-to-end, the policy upsert, workspace isolation, and the auth
 * guard. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('absences (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-abs-a'
  const idB = 'itest-abs-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'abs-a@itest.local'],
      [idB, 'abs-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    const ws = [wsA, wsB]
    await db.delete(absences).where(inArray(absences.workspaceId, ws))
    await db.delete(absencePolicies).where(inArray(absencePolicies.workspaceId, ws))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('BalanceCountsOnlyVacationAgainstThePolicy', async () => {
    await svc.setPolicy(db, wsA, { annualAllowanceDays: 30, carryOverDays: 5 })
    await svc.createAbsence(db, wsA, idA, {
      kind: 'vacation',
      startDate: '2026-07-14',
      endDate: '2026-07-17',
    }) // 4
    await svc.createAbsence(db, wsA, idA, {
      kind: 'vacation',
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      halfDay: true,
    }) // 0.5
    await svc.createAbsence(db, wsA, idA, {
      kind: 'sick',
      startDate: '2026-07-06',
      endDate: '2026-07-06',
    }) // ignored

    const bal = await svc.balanceForYear(db, wsA, 2026)
    expect(bal.usedDays).toBe(4.5)
    expect(bal.remainingDays).toBe(30 + 5 - 4.5)
  })

  it('PolicyUpsertReplacesTheRow', async () => {
    await svc.setPolicy(db, wsA, { annualAllowanceDays: 25, carryOverDays: 0 })
    await svc.setPolicy(db, wsA, { annualAllowanceDays: 28, carryOverDays: 3 })
    const policy = await svc.getPolicy(db, wsA)
    expect(policy.annualAllowanceDays).toBe(28)
    expect(policy.carryOverDays).toBe(3)
  })

  it('ListIsScopedToTheWorkspace', async () => {
    await svc.createAbsence(db, wsA, idA, {
      kind: 'vacation',
      startDate: '2026-07-14',
      endDate: '2026-07-17',
    })
    const listB = await svc.listAbsences(db, wsB, { from: '2026-01-01', to: '2026-12-31' })
    expect(listB).toEqual([])
    const balB = await svc.balanceForYear(db, wsB, 2026)
    expect(balB.usedDays).toBe(0)
  })

  it('CreateAndDeleteRoundTrips', async () => {
    const created = await svc.createAbsence(db, wsA, idA, {
      kind: 'holiday',
      startDate: '2026-07-29',
      endDate: '2026-07-29',
    })
    await svc.deleteAbsence(db, wsA, created.id)
    const list = await svc.listAbsences(db, wsA, { from: '2026-01-01', to: '2026-12-31' })
    expect(list).toEqual([])
  })

  it('GetList_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/absences?from=2026-01-01&to=2026-12-31',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
