import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../../config.js'
import { createDb } from '../../../db/client.js'
import { user } from '../../../db/auth-schema.js'
import { exportRecords, workspaces } from '../../../db/schema.js'
import { buildApp } from '../../../app.js'
import { resolveWorkspaceId } from '../../../core/workspace.js'
import { NullExportTarget } from './null-export.js'
import { listExportRecords, runRecordedExport } from './ledger.js'
import type { ExportItem } from './port.js'

/**
 * The dev-tool export ledger against a REAL Postgres (REQ-035, #44 · ADR-0035/0015).
 * Covers the acceptance-critical invariants: the ledger is workspace-isolated by
 * construction (A's records are invisible to B), a run against the honest
 * `NullExportTarget` records its `unavailable` outcomes rather than silently dropping
 * them (ADR-0005), a re-run never double-records the same `dedupeKey`, and the guard
 * rejects unauthenticated callers. Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

const item = (over: Partial<ExportItem> = {}): ExportItem => ({
  dedupeKey: 'meeting:1:action:0',
  title: 'Ship the report',
  confirmed: true,
  ...over,
})

describe.skipIf(!databaseUrl)('export records (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-export-a'
  const idB = 'itest-export-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'export-a@itest.local'],
      [idB, 'export-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    await db.delete(exportRecords).where(inArray(exportRecords.workspaceId, [wsA, wsB]))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  it('ExportRecords_AreWorkspaceIsolated', async () => {
    await runRecordedExport(db, wsA, new NullExportTarget(), 'jira', [item()])

    const mine = await listExportRecords(db, wsA)
    expect(mine).toHaveLength(1)
    expect(mine[0]?.workspaceId).toBe(wsA)

    // Negative isolation: B sees none of A's ledger (ADR-0015).
    expect(await listExportRecords(db, wsB)).toEqual([])
  })

  it('Run_NullTarget_RecordsHonestOutcomes_AndNeverDoubleRecordsAKey', async () => {
    const items = [item(), item({ dedupeKey: 'meeting:1:action:1', title: 'Book the follow-up' })]

    await runRecordedExport(db, wsA, new NullExportTarget(), 'jira', items)
    // A re-run of the identical batch must not add a second row per dedupeKey.
    await runRecordedExport(db, wsA, new NullExportTarget(), 'jira', items)

    const rows = await listExportRecords(db, wsA)
    expect(rows).toHaveLength(2)
    // The Null target is honestly unavailable: nothing sent, outcome recorded as such.
    for (const row of rows) {
      expect(row.status).toBe('unavailable')
      expect(row.target).toBe('jira')
      expect(row.externalId).toBeNull()
    }
    const keys = rows.map(r => r.dedupeKey).sort()
    expect(keys).toEqual(['meeting:1:action:0', 'meeting:1:action:1'])
    expect(rows.find(r => r.dedupeKey === 'meeting:1:action:0')?.itemLabel).toBe('Ship the report')
  })

  it('GetRecords_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/ai/export/records' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
