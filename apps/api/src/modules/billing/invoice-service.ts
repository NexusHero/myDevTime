import { and, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { invoiceLines, summarizeInvoice, type InvoiceLine, type TimeEntry } from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { clients, invoices, projects, timeEntries, workspaces } from '../../db/schema.js'
import { NotFoundError, ValidationError } from '../../errors.js'
import { listRates, toRule } from './service.js'
import { type InvoiceExport } from './export/invoice-csv.js'

/**
 * Invoicing / "Abrechnung" persistence (design v6, REQ-005/009). The money is
 * computed by the deterministic `packages/domain/invoicing` core — this layer
 * only loads the eligible entries, freezes an issued invoice's totals, and stamps
 * the billed entries so they leave the "open" pool. Server-authoritative: a
 * client's requested selection is intersected with the entries that are actually
 * eligible, so no one can bill foreign, non-billable, or already-invoiced time.
 * Every query is scoped by `workspace_id` (ADR-0015).
 */

export interface InvoicePreview {
  readonly lines: readonly InvoiceLine[]
  readonly currencyCode: string
}

export interface IssuedInvoice {
  readonly id: string
  readonly clientId: string | null
  readonly periodStart: Date
  readonly periodEnd: Date
  readonly totalMs: number
  readonly totalMinor: number
  readonly currencyCode: string
  readonly issuedAt: Date
}

interface InvoiceInput {
  readonly clientId: string
  readonly from: Date
  readonly to: Date
}

/** Map a DB time-entry row into the domain `TimeEntry` (optional keys omitted). */
function toDomainEntry(e: typeof timeEntries.$inferSelect): TimeEntry {
  return {
    id: e.id,
    start: e.startedAt.getTime(),
    end: e.endedAt ? e.endedAt.getTime() : null,
    billable: e.billable,
    source: e.source,
    ...(e.projectId !== null ? { projectId: e.projectId } : {}),
    ...(e.taskId !== null ? { taskId: e.taskId } : {}),
    ...(e.note !== null ? { note: e.note } : {}),
  }
}

/**
 * The still-open, billable lines for a client's work in a window — priced by the
 * deterministic core. Excludes already-invoiced entries (`invoiced_at IS NULL`).
 */
async function computeLines(
  db: Db,
  workspaceId: string,
  input: InvoiceInput,
): Promise<InvoiceLine[]> {
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.clientId, input.clientId),
        isNull(projects.deletedAt),
      ),
    )
  const projectIds = projectRows.map(p => p.id)
  if (projectIds.length === 0) return []
  const clientByProject = new Map<string, string | null>(projectIds.map(id => [id, input.clientId]))

  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.deletedAt),
        isNull(timeEntries.invoicedAt),
        eq(timeEntries.billable, true),
        inArray(timeEntries.projectId, projectIds),
        gte(timeEntries.startedAt, input.from),
        lt(timeEntries.startedAt, input.to),
      ),
    )

  const rules = (await listRates(db, workspaceId)).map(toRule)
  return [
    ...invoiceLines(rows.map(toDomainEntry), clientByProject, rules, {
      from: input.from.getTime(),
      to: input.to.getTime(),
    }),
  ]
}

async function workspaceCurrency(db: Db, workspaceId: string): Promise<string> {
  const row = (
    await db
      .select({ c: workspaces.currencyCode })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
  )[0]
  if (!row) throw new NotFoundError('workspace not found')
  return row.c
}

/** Preview: the open billable lines for the client + window, nothing persisted. */
export async function previewInvoice(
  db: Db,
  workspaceId: string,
  input: InvoiceInput,
): Promise<InvoicePreview> {
  await assertClient(db, workspaceId, input.clientId)
  return {
    lines: await computeLines(db, workspaceId, input),
    currencyCode: await workspaceCurrency(db, workspaceId),
  }
}

/**
 * Issue an invoice for the selected entries: recompute the eligible lines
 * server-side, freeze the selected subset's totals, and stamp those entries as
 * invoiced — all in one transaction so a partial write can never leave hours
 * half-billed.
 */
export async function issueInvoice(
  db: Db,
  workspaceId: string,
  input: InvoiceInput & { entryIds: readonly string[] },
): Promise<IssuedInvoice> {
  await assertClient(db, workspaceId, input.clientId)
  const currencyCode = await workspaceCurrency(db, workspaceId)
  return db.transaction(async tx => {
    const lines = await computeLines(tx, workspaceId, input)
    const eligible = new Set(lines.map(l => l.entryId))
    const selected = input.entryIds.filter(id => eligible.has(id))
    if (selected.length === 0)
      throw new ValidationError('No billable, un-invoiced entries selected')
    const draft = summarizeInvoice(lines, new Set(selected))

    const invoice = one(
      await tx
        .insert(invoices)
        .values({
          workspaceId,
          clientId: input.clientId,
          periodStart: input.from,
          periodEnd: input.to,
          totalMs: draft.totalDurationMs,
          totalMinor: draft.totalMinor,
          currencyCode,
        })
        .returning(),
    )
    await tx
      .update(timeEntries)
      .set({ invoiceId: invoice.id, invoicedAt: invoice.issuedAt })
      .where(
        and(
          eq(timeEntries.workspaceId, workspaceId),
          inArray(timeEntries.id, selected),
          isNull(timeEntries.invoicedAt),
        ),
      )
    return invoice
  })
}

/** Void an invoice (undo): return its entries to the open pool and delete it. */
export async function voidInvoice(db: Db, workspaceId: string, id: string): Promise<void> {
  await db.transaction(async tx => {
    const rows = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    if (rows.length === 0) throw new NotFoundError('invoice not found')
    await tx
      .update(timeEntries)
      .set({ invoiceId: null, invoicedAt: null })
      .where(and(eq(timeEntries.workspaceId, workspaceId), eq(timeEntries.invoiceId, id)))
    await tx.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
  })
}

/** All issued invoices for the workspace, newest first. */
export function listInvoices(db: Db, workspaceId: string): Promise<IssuedInvoice[]> {
  return db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      totalMs: invoices.totalMs,
      totalMinor: invoices.totalMinor,
      currencyCode: invoices.currencyCode,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .where(eq(invoices.workspaceId, workspaceId))
    .orderBy(desc(invoices.issuedAt)) // newest first (matches the documented contract)
}

/** Open (un-invoiced) billable hours + money per client — the Projects header
 *  figures (design v6). Every completed, billable, un-invoiced, priced entry
 *  whose project belongs to a client, grouped by client, most-money first. */
export interface ClientOpen {
  readonly clientId: string
  readonly openMs: number
  readonly openMinor: number
}

export async function openBillableByClient(
  db: Db,
  workspaceId: string,
): Promise<{ clients: ClientOpen[]; currencyCode: string }> {
  const clientByProject = new Map<string, string | null>()
  for (const p of await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))) {
    clientByProject.set(p.id, p.clientId)
  }

  const rows = await db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, workspaceId),
        isNull(timeEntries.deletedAt),
        isNull(timeEntries.invoicedAt),
        eq(timeEntries.billable, true),
      ),
    )
  const rules = (await listRates(db, workspaceId)).map(toRule)
  // All-time window: 0 → max instant, so every completed billable entry is a line.
  const lines = invoiceLines(rows.map(toDomainEntry), clientByProject, rules, {
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
  })

  const byClient = new Map<string, { ms: number; minor: number }>()
  for (const l of lines) {
    const clientId = clientByProject.get(l.projectId)
    if (!clientId) continue // internal/no-client work is not billed to anyone
    const acc = byClient.get(clientId) ?? { ms: 0, minor: 0 }
    acc.ms += l.durationMs
    acc.minor += l.amountMinor
    byClient.set(clientId, acc)
  }

  const clients = [...byClient.entries()]
    .map(([clientId, v]) => ({ clientId, openMs: v.ms, openMinor: v.minor }))
    .sort((a, b) => b.openMinor - a.openMinor || a.clientId.localeCompare(b.clientId))
  return { clients, currencyCode: await workspaceCurrency(db, workspaceId) }
}

/**
 * The frozen invoice + its priced lines for export (design v6, B4). Loads the
 * entries stamped with this invoice and re-derives each line via the same
 * deterministic core (rates are effective-dated, so the per-line amounts match
 * what was frozen); the totals returned are the invoice's stored figures.
 */
export async function getInvoiceExport(
  db: Db,
  workspaceId: string,
  id: string,
): Promise<InvoiceExport> {
  const invoice = (
    await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
  )[0]
  if (!invoice) throw new NotFoundError('invoice not found')

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
  const nameByProject = new Map(projectRows.map(p => [p.id, p.name]))
  const clientByProject = new Map<string, string | null>(projectRows.map(p => [p.id, p.clientId]))

  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.workspaceId, workspaceId), eq(timeEntries.invoiceId, id)))
  const rules = (await listRates(db, workspaceId)).map(toRule)
  const lines = invoiceLines(rows.map(toDomainEntry), clientByProject, rules, {
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
  })

  const clientName =
    invoice.clientId === null
      ? null
      : ((
          await db
            .select({ name: clients.name })
            .from(clients)
            .where(and(eq(clients.id, invoice.clientId), eq(clients.workspaceId, workspaceId)))
        )[0]?.name ?? null)

  const senderName =
    (
      await db
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
    )[0]?.name ?? 'myDevTime'

  return {
    id: invoice.id,
    senderName,
    clientName,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    issuedAt: invoice.issuedAt,
    currencyCode: invoice.currencyCode,
    totalMs: invoice.totalMs,
    totalMinor: invoice.totalMinor,
    lines: lines.map(l => ({
      projectName: nameByProject.get(l.projectId) ?? 'Projekt',
      note: l.note,
      start: l.start,
      durationMs: l.durationMs,
      amountMinor: l.amountMinor,
    })),
  }
}

async function assertClient(db: Db, workspaceId: string, clientId: string): Promise<void> {
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.workspaceId, workspaceId),
        isNull(clients.deletedAt),
      ),
    )
  if (rows.length === 0) throw new NotFoundError('client not found')
}

function one<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}
