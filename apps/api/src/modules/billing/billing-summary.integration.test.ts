import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { projects, rates, timeEntries, workspaces } from '../../db/schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { createProject } from '../tracking/service.js'
import { createManualEntry } from '../tracking/entries-service.js'
import * as billing from './service.js'

/**
 * The windowed billing summary against a REAL Postgres (SKILL §3.3): only
 * *billable* entries that started inside the window are priced (at the rate in
 * effect at their start), summed per project and overall. Covers windowing, the
 * billable filter, workspace isolation, and the auth guard. Skips without
 * DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('billing summary (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-billsum-a'
  const idB = 'itest-billsum-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'billsum-a@itest.local'],
      [idB, 'billsum-b@itest.local'],
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
    await db.delete(rates).where(inArray(rates.workspaceId, ws))
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
  const window = {
    from: d('2026-07-06T00:00:00Z'),
    to: d('2026-07-13T00:00:00Z'),
    asOf: d('2026-07-20T00:00:00Z'),
  }

  it('PricesOnlyBillableInWindowEntriesPerProject', async () => {
    const project = await createProject(db, wsA, { name: 'Finanzo' })
    await billing.createRate(db, wsA, {
      level: 'workspace',
      amountMinorPerHour: 6000,
      effectiveFrom: d('2020-01-01T00:00:00Z'),
    })
    // 2h billable, inside the window → priced.
    await createManualEntry(db, wsA, idA, {
      startedAt: d('2026-07-07T09:00:00Z'),
      endedAt: d('2026-07-07T11:00:00Z'),
      projectId: project.id,
      billable: true,
    })
    // Outside the window → ignored.
    await createManualEntry(db, wsA, idA, {
      startedAt: d('2026-07-01T09:00:00Z'),
      endedAt: d('2026-07-01T13:00:00Z'),
      projectId: project.id,
      billable: true,
    })
    // Inside the window but non-billable → ignored.
    await createManualEntry(db, wsA, idA, {
      startedAt: d('2026-07-08T09:00:00Z'),
      endedAt: d('2026-07-08T15:00:00Z'),
      projectId: project.id,
      billable: false,
    })

    const summary = await billing.billingSummary(db, wsA, window)
    expect(summary.billableMinor).toBe(2 * 6000)
    expect(summary.byProject).toEqual([{ projectId: project.id, costMinor: 12000 }])
    expect(summary.currencyCode).toBe('EUR')
  })

  it('IsScopedToTheWorkspace', async () => {
    const project = await createProject(db, wsA, { name: 'X' })
    await billing.createRate(db, wsA, {
      level: 'workspace',
      amountMinorPerHour: 6000,
      effectiveFrom: d('2020-01-01T00:00:00Z'),
    })
    await createManualEntry(db, wsA, idA, {
      startedAt: d('2026-07-07T09:00:00Z'),
      endedAt: d('2026-07-07T10:00:00Z'),
      projectId: project.id,
      billable: true,
    })
    const b = await billing.billingSummary(db, wsB, window)
    expect(b.billableMinor).toBe(0)
    expect(b.byProject).toEqual([])
  })

  it('GetSummary_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/summary?from=2026-07-06T00:00:00Z&to=2026-07-13T00:00:00Z',
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
