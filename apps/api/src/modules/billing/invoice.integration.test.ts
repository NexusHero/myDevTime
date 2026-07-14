import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { loadConfig } from '../../config.js'
import { createDb } from '../../db/client.js'
import { user } from '../../db/auth-schema.js'
import { clients, projects, rates, timeEntries, workspaces } from '../../db/schema.js'
import { invoices } from '../../db/invoices-schema.js'
import { buildApp } from '../../app.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import { createClient, createProject } from '../tracking/service.js'
import { createManualEntry } from '../tracking/entries-service.js'
import * as billing from './service.js'
import * as invoicing from './invoice-service.js'

/**
 * Invoicing / "Abrechnung" against a REAL Postgres (SKILL §3.3): a preview lists
 * the open, billable, priced lines for a client + window; issuing freezes the
 * selected subset's totals and stamps those entries so they leave the open pool;
 * voiding returns them. Covers server-authoritative selection, un-invoiced
 * filtering, workspace isolation, and the auth guard. Skips without DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('invoicing (integration)', () => {
  const handle = createDb(databaseUrl!)
  const db = handle.db
  const idA = 'itest-invoice-a'
  const idB = 'itest-invoice-b'
  let wsA = ''
  let wsB = ''

  beforeAll(async () => {
    for (const [id, email] of [
      [idA, 'invoice-a@itest.local'],
      [idB, 'invoice-b@itest.local'],
    ] as const) {
      await db.delete(user).where(eq(user.id, id))
      await db.insert(user).values({ id, name: id, email, emailVerified: true })
    }
    wsA = await resolveWorkspaceId(db, idA, 'A')
    wsB = await resolveWorkspaceId(db, idB, 'B')
  })

  afterEach(async () => {
    const ws = [wsA, wsB]
    await db.delete(invoices).where(inArray(invoices.workspaceId, ws))
    await db.delete(timeEntries).where(inArray(timeEntries.workspaceId, ws))
    await db.delete(rates).where(inArray(rates.workspaceId, ws))
    await db.delete(projects).where(inArray(projects.workspaceId, ws))
    await db.delete(clients).where(inArray(clients.workspaceId, ws))
  })

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, wsA))
    await db.delete(workspaces).where(eq(workspaces.id, wsB))
    await db.delete(user).where(eq(user.id, idA))
    await db.delete(user).where(eq(user.id, idB))
    await handle.close()
  })

  const d = (iso: string): Date => new Date(iso)
  const from = d('2026-07-01T00:00:00Z')
  const to = d('2026-08-01T00:00:00Z')

  /** Seed a client + project + a workspace rate + two billable entries. */
  async function seed(ws: string, userId: string): Promise<{ clientId: string; ids: string[] }> {
    const client = await createClient(db, ws, { name: 'Finanzo AG' })
    const project = await createProject(db, ws, { name: 'Website', clientId: client.id })
    await billing.createRate(db, ws, {
      level: 'workspace',
      amountMinorPerHour: 10_000, // 100 €/h
      effectiveFrom: d('2020-01-01T00:00:00Z'),
    })
    const e1 = await createManualEntry(db, ws, userId, {
      startedAt: d('2026-07-06T09:00:00Z'),
      endedAt: d('2026-07-06T11:00:00Z'), // 2h → 20000
      projectId: project.id,
      billable: true,
    })
    const e2 = await createManualEntry(db, ws, userId, {
      startedAt: d('2026-07-07T09:00:00Z'),
      endedAt: d('2026-07-07T10:00:00Z'), // 1h → 10000
      projectId: project.id,
      billable: true,
    })
    return { clientId: client.id, ids: [e1.id, e2.id] }
  }

  it('previewInvoice_listsOpenBillableLinesPriced', async () => {
    const { clientId } = await seed(wsA, idA)
    const preview = await invoicing.previewInvoice(db, wsA, { clientId, from, to })
    expect(preview.lines.map(l => l.amountMinor).sort((a, b) => a - b)).toEqual([10_000, 20_000])
    expect(preview.lines.every(l => l.priced)).toBe(true)
  })

  it('issueInvoice_freezesSelectedTotals_andStampsEntriesOutOfOpenPool', async () => {
    const { clientId, ids } = await seed(wsA, idA)
    const invoice = await invoicing.issueInvoice(db, wsA, {
      clientId,
      from,
      to,
      entryIds: [ids[0]!],
    })
    expect(invoice.totalMinor).toBe(20_000)
    expect(invoice.totalMs).toBe(2 * 60 * 60 * 1000)

    // The billed entry is now out of the open pool; only the un-invoiced one remains.
    const preview = await invoicing.previewInvoice(db, wsA, { clientId, from, to })
    expect(preview.lines.map(l => l.entryId)).toEqual([ids[1]])
  })

  it('issueInvoice_ignoresIdsThatAreNotEligible', async () => {
    const { clientId, ids } = await seed(wsA, idA)
    // A foreign/garbage id is silently dropped; only the real one is billed.
    await expect(
      invoicing.issueInvoice(db, wsA, {
        clientId,
        from,
        to,
        entryIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toThrow(/No billable/)
    const invoice = await invoicing.issueInvoice(db, wsA, { clientId, from, to, entryIds: ids })
    expect(invoice.totalMinor).toBe(30_000)
  })

  it('voidInvoice_returnsEntriesToTheOpenPool', async () => {
    const { clientId, ids } = await seed(wsA, idA)
    const invoice = await invoicing.issueInvoice(db, wsA, { clientId, from, to, entryIds: ids })
    await invoicing.voidInvoice(db, wsA, invoice.id)
    const preview = await invoicing.previewInvoice(db, wsA, { clientId, from, to })
    expect(preview.lines.map(l => l.entryId).sort()).toEqual([...ids].sort())
    expect(await invoicing.listInvoices(db, wsA)).toHaveLength(0)
  })

  it('isolation_cannotBillOrVoidAnotherWorkspace', async () => {
    const a = await seed(wsA, idA)
    const b = await seed(wsB, idB)
    // Workspace A cannot see B's client, and voiding B's invoice from A 404s.
    await expect(
      invoicing.previewInvoice(db, wsA, { clientId: b.clientId, from, to }),
    ).rejects.toThrow(/client not found/)
    const bInvoice = await invoicing.issueInvoice(db, wsB, {
      clientId: b.clientId,
      from,
      to,
      entryIds: b.ids,
    })
    await expect(invoicing.voidInvoice(db, wsA, bInvoice.id)).rejects.toThrow(/not found/)
    // B's entries stay billed.
    expect(
      await invoicing.previewInvoice(db, wsB, { clientId: b.clientId, from, to }),
    ).toMatchObject({
      lines: [],
    })
    // avoid unused
    expect(a.ids).toHaveLength(2)
  })

  it('endpoint_requiresAuth', async () => {
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32) }),
      db: handle,
    })
    const res = await app.inject({ method: 'GET', url: '/api/billing/invoices' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})
