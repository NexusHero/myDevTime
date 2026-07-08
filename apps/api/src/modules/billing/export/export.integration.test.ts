import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { loadConfig } from '../../../config.js'
import { createDb } from '../../../db/client.js'
import { user } from '../../../db/auth-schema.js'
import { workspaces } from '../../../db/schema.js'
import { buildApp } from '../../../app.js'
import { resolveWorkspaceId } from '../../../core/workspace.js'
import { createProject } from '../../tracking/service.js'
import { createManualEntry } from '../../tracking/entries-service.js'
import { createRate, projectCost } from '../service.js'
import { loadTimesheet } from './timesheet-source.js'
import { timesheetToCsv } from './csv.js'
import { moneyMajor } from './format.js'
import { NO_ROUNDING } from '@mydevtime/domain'

/**
 * Timesheet export against a REAL Postgres (SKILL §3.3): the DB assembly agrees
 * with the money service (single source of truth), the CSV renders the same
 * total, cross-workspace access is denied, and the endpoint is auth-guarded.
 * Skips without DATABASE_URL; CI provides Postgres.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('timesheet export (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-exp-a'
  const idB = 'itest-exp-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'exp-a@itest.local'],
      [idB, 'exp-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  async function seededProject(): Promise<string> {
    const project = await createProject(db, wsA, { name: `Export ${randomUUID().slice(0, 8)}` })
    await createRate(db, wsA, {
      level: 'project',
      scopeId: project.id,
      amountMinorPerHour: 9000,
      effectiveFrom: new Date('2020-01-01'),
    })
    await createManualEntry(db, wsA, idA, {
      startedAt: new Date('2026-06-02T09:00:00Z'),
      endedAt: new Date('2026-06-02T11:00:00Z'), // 2h → 18000
      projectId: project.id,
    })
    return project.id
  }

  it('LoadTimesheet_TotalMatchesProjectCost_AndCsvRendersIt', async () => {
    const projectId = await seededProject()
    const { timesheet, meta } = await loadTimesheet(db, wsA, {
      projectId,
      groupBy: 'project',
      rounding: NO_ROUNDING,
      billableOnly: false,
      asOf: new Date(),
    })
    const cost = await projectCost(db, wsA, projectId, new Date())
    expect(timesheet.totalAmountMinor).toBe(cost.costMinor)
    expect(timesheet.totalAmountMinor).toBe(18000)

    const csv = timesheetToCsv(timesheet, meta)
    const totalRow = csv.split('\r\n').find(l => l.startsWith('Total'))
    expect(totalRow?.split(',').at(-1)).toBe(moneyMajor(cost.costMinor))
  })

  it('LoadTimesheet_CrossWorkspace_IsDenied', async () => {
    const projectId = await seededProject()
    await expect(
      loadTimesheet(db, wsB, {
        projectId,
        groupBy: 'project',
        rounding: NO_ROUNDING,
        billableOnly: false,
        asOf: new Date(),
      }),
    ).rejects.toThrow(/not found/)
  })

  it('GetTimesheet_Unauthenticated_Returns401', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/billing/projects/${randomUUID()}/timesheet?format=csv`,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
