import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { recurringEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import * as svc from './service.js'

/**
 * Recurring series against a REAL Postgres (SKILL §3.3): create/list, occurrence projection over
 * a window, the Outlook "this and following" truncate, workspace isolation, and the auth guard.
 * The occurrence math is the deterministic core's; this pins the persistence + scoping. Skips
 * without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('recurrence (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-rec-a'
  const idB = 'itest-rec-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'rec-a@itest.local'],
      [idB, 'rec-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(recurringEntries).where(inArray(recurringEntries.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('CreatesAndProjectsAWeeklySeries', async () => {
    await svc.createSeries(db, wsA, idA, {
      kind: 'focus',
      title: 'Standup',
      anchorDate: '2026-07-06',
      startMin: 540,
      lenMin: 30,
      freq: 'weekly',
      end: { kind: 'never' },
    })
    const occ = await svc.listOccurrences(db, wsA, '2026-07-06', '2026-07-27')
    expect(occ.map(o => o.date)).toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'])
    expect(occ[0]).toMatchObject({ title: 'Standup', startMin: 540, lenMin: 30 })
  })

  it('PersistsPriorityAndNote_forAHandCreatedEntry', async () => {
    await svc.createSeries(db, wsA, idA, {
      kind: 'focus',
      title: 'SEPA export',
      anchorDate: '2026-07-06',
      startMin: 540,
      lenMin: 120,
      freq: 'weekly',
      end: { kind: 'count', count: 1 },
      priority: 1,
      note: 'validate against pain.008 schema',
    })
    const occ = await svc.listOccurrences(db, wsA, '2026-07-06', '2026-07-27')
    expect(occ).toHaveLength(1) // count:1 → a single occurrence
    expect(occ[0]).toMatchObject({
      title: 'SEPA export',
      priority: 1,
      note: 'validate against pain.008 schema',
    })
  })

  it('TruncateEndsTheSeriesBeforeTheSplitDate', async () => {
    const series = await svc.createSeries(db, wsA, idA, {
      kind: 'focus',
      title: 'Standup',
      anchorDate: '2026-07-06',
      startMin: 540,
      lenMin: 30,
      freq: 'weekly',
      end: { kind: 'never' },
    })
    await svc.truncateSeries(db, wsA, series.id, '2026-07-20')
    const occ = await svc.listOccurrences(db, wsA, '2026-07-06', '2026-08-31')
    // The original series now ends the day before the split → last kept occurrence is 07-13.
    expect(occ.map(o => o.date)).toEqual(['2026-07-06', '2026-07-13'])
  })

  it('OccurrencesAreScopedToTheWorkspace', async () => {
    await svc.createSeries(db, wsA, idA, {
      kind: 'focus',
      title: 'A-only',
      anchorDate: '2026-07-06',
      startMin: 540,
      lenMin: 30,
      freq: 'weekly',
      end: { kind: 'never' },
    })
    expect(await svc.listOccurrences(db, wsB, '2026-07-06', '2026-07-27')).toEqual([])
    expect(await svc.listSeries(db, wsB)).toEqual([])
  })

  it('CreateAndDeleteRoundTrips', async () => {
    const series = await svc.createSeries(db, wsA, idA, {
      kind: 'break',
      title: 'Lunch',
      anchorDate: '2026-07-06',
      startMin: 720,
      lenMin: 45,
      freq: 'daily',
      end: { kind: 'count', count: 3 },
    })
    await svc.deleteSeries(db, wsA, series.id)
    expect(await svc.listSeries(db, wsA)).toEqual([])
  })

  it('GetOccurrences_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/recurrence/occurrences?from=2026-07-06&to=2026-07-27',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
