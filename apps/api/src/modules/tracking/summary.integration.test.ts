import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { timeEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from './workspace.js'
import * as entries from './entries-service.js'
import { summarize } from './summary-service.js'

/**
 * The reporting summary against a REAL Postgres (SKILL §3.3): stored entries flow
 * through the deterministic `summarizeEntries`, and the endpoint is workspace-
 * scoped (negative isolation) and guarded. Per-project/day shaping is unit-tested
 * in `packages/domain`; here we prove the DB → core → summary wiring. Skips
 * without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL
const H = 3_600_000
const M = 60_000

describe.skipIf(!databaseUrl)('tracking summary (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-summary-a'
  const idB = 'itest-summary-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'summary-a@itest.local'],
      [idB, 'summary-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const t = (iso: string): Date => new Date(iso)
  const window = { from: t('2026-07-06T00:00:00Z'), to: t('2026-07-08T00:00:00Z'), tz: 'UTC' }

  it('Summarize_AggregatesTotalsBillableAndDayAxis', async () => {
    await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-06T09:00:00Z'),
      endedAt: t('2026-07-06T11:00:00Z'),
      billable: true,
    })
    await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-07T10:00:00Z'),
      endedAt: t('2026-07-07T10:30:00Z'),
      billable: false,
    })

    const summary = await summarize(db, wsA, window)
    expect(summary.totalMs).toBe(2 * H + 30 * M)
    expect(summary.billableMs).toBe(2 * H)
    expect(summary.days).toEqual(['2026-07-06', '2026-07-07'])
    expect(summary.byProject).toHaveLength(1)
    expect(summary.byProject[0]?.projectId).toBe('(none)')
    expect(summary.byProject[0]?.daily).toEqual([2 * H, 30 * M])
  })

  it('Summarize_IsScopedToTheWorkspace', async () => {
    await entries.createManualEntry(db, wsA, idA, {
      startedAt: t('2026-07-06T09:00:00Z'),
      endedAt: t('2026-07-06T10:00:00Z'),
      billable: true,
    })
    const b = await summarize(db, wsB, window)
    expect(b.totalMs).toBe(0)
    expect(b.byProject).toEqual([])
  })

  it('GetSummary_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/tracking/summary?from=2026-07-06T00:00:00Z&to=2026-07-08T00:00:00Z',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
