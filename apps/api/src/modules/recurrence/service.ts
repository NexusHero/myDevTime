import { and, eq } from 'drizzle-orm'
import {
  expandRecurrence,
  truncateBefore,
  type RecurrenceEnd,
  type RecurrenceFreq,
  type RecurrenceRule,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { recurringEntries } from '../../db/schema.js'
import { NotFoundError } from '../../errors.js'

/**
 * Recurring-entry persistence (REQ-060, design v17 §F4): stores one **series** rule and projects
 * its occurrences at read time via the deterministic `expandRecurrence` core (ADR-0005) — no
 * per-occurrence rows. Workspace-scoped by construction (ADR-0015). The occurrence math is the
 * domain's; the service only stores rows and shapes them into the core's input.
 */

export type SeriesRow = typeof recurringEntries.$inferSelect

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

/** Rebuild the pure `RecurrenceRule` from a stored row's columns. */
export function rowToRule(row: {
  freq: string
  endKind: string
  untilDate: string | null
  count: number | null
}): RecurrenceRule {
  const end: RecurrenceEnd =
    row.endKind === 'until' && row.untilDate !== null
      ? { kind: 'until', date: row.untilDate }
      : row.endKind === 'count' && row.count !== null
        ? { kind: 'count', count: row.count }
        : { kind: 'never' }
  return { freq: row.freq as RecurrenceFreq, end }
}

/** One concrete occurrence of a series on a given calendar day. */
export interface Occurrence {
  readonly seriesId: string
  readonly kind: string
  readonly title: string
  readonly date: string
  readonly startMin: number
  readonly lenMin: number
  readonly projectId: string | null
}

/**
 * Project every series' occurrences within `[from, to]` (inclusive), sorted by date then start.
 * **Pure** — the DB CRUD lives below; this is the tested heart of the endpoint, so the expansion
 * can be verified without a database.
 */
export function seriesToOccurrences(
  rows: readonly SeriesRow[],
  from: string,
  to: string,
): Occurrence[] {
  const out: Occurrence[] = []
  for (const row of rows) {
    for (const date of expandRecurrence(rowToRule(row), row.anchorDate, from, to)) {
      out.push({
        seriesId: row.id,
        kind: row.kind,
        title: row.title,
        date,
        startMin: row.startMin,
        lenMin: row.lenMin,
        projectId: row.projectId,
      })
    }
  }
  return out.sort((a, b) =>
    a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1,
  )
}

export interface CreateSeriesInput {
  kind: string
  title: string
  anchorDate: string
  startMin: number
  lenMin: number
  freq: Exclude<RecurrenceFreq, 'none'>
  end: RecurrenceEnd
  projectId?: string | null | undefined
}

/** Create a recurring series in the caller's workspace. */
export async function createSeries(
  db: Db,
  workspaceId: string,
  userId: string,
  input: CreateSeriesInput,
): Promise<SeriesRow> {
  const rows = await db
    .insert(recurringEntries)
    .values({
      workspaceId,
      userId,
      kind: input.kind,
      title: input.title,
      anchorDate: input.anchorDate,
      startMin: input.startMin,
      lenMin: input.lenMin,
      freq: input.freq,
      endKind: input.end.kind,
      untilDate: input.end.kind === 'until' ? input.end.date : null,
      count: input.end.kind === 'count' ? input.end.count : null,
      projectId: input.projectId ?? null,
    })
    .returning()
  return first(rows)
}

/** List the workspace's series, earliest anchor first. */
export async function listSeries(db: Db, workspaceId: string): Promise<SeriesRow[]> {
  return db
    .select()
    .from(recurringEntries)
    .where(eq(recurringEntries.workspaceId, workspaceId))
    .orderBy(recurringEntries.anchorDate)
}

/** The workspace's occurrences within `[from, to]` (inclusive). */
export async function listOccurrences(
  db: Db,
  workspaceId: string,
  from: string,
  to: string,
): Promise<Occurrence[]> {
  return seriesToOccurrences(await listSeries(db, workspaceId), from, to)
}

/** Delete a series in the caller's workspace. */
export async function deleteSeries(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .delete(recurringEntries)
    .where(and(eq(recurringEntries.workspaceId, workspaceId), eq(recurringEntries.id, id)))
    .returning({ id: recurringEntries.id })
  if (rows.length === 0) throw new NotFoundError('series not found')
}

/**
 * Split a series for a "this and everything after" edit (Outlook convention): end the original
 * series the day before `at` via the deterministic `truncateBefore`. The caller starts a fresh
 * series at `at` for the edited occurrences (a separate `createSeries` call).
 */
export async function truncateSeries(
  db: Db,
  workspaceId: string,
  id: string,
  at: string,
): Promise<SeriesRow> {
  const existing = await db
    .select()
    .from(recurringEntries)
    .where(and(eq(recurringEntries.workspaceId, workspaceId), eq(recurringEntries.id, id)))
    .limit(1)
  const row = existing[0]
  if (!row) throw new NotFoundError('series not found')
  const truncated = truncateBefore(rowToRule(row), at)
  const rows = await db
    .update(recurringEntries)
    .set({
      endKind: truncated.end.kind,
      untilDate: truncated.end.kind === 'until' ? truncated.end.date : null,
      count: truncated.end.kind === 'count' ? truncated.end.count : null,
    })
    .where(and(eq(recurringEntries.workspaceId, workspaceId), eq(recurringEntries.id, id)))
    .returning()
  return first(rows)
}
