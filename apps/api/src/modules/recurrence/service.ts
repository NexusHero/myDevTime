import { and, eq } from 'drizzle-orm'
import {
  expandRecurrence,
  truncateBefore,
  type RecurrenceEnd,
  type RecurrenceFreq,
  type RecurrenceRule,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { recurringEntries, type MeetingAttendee } from '../../db/schema.js'
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
  /** Planning metadata carried from the series (design v19): task priority + free-text note. */
  readonly priority: number | null
  readonly note: string | null
  /** Meeting detail carried from the series (REQ-075): where, who, how to join. */
  readonly location: string | null
  /** Always a list — an entry with no attendees has an empty one, never a null to special-case. */
  readonly attendees: readonly MeetingAttendee[]
  readonly conferenceUrl: string | null
  readonly conferenceProvider: string | null
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
        priority: row.priority,
        note: row.note,
        location: row.location,
        attendees: row.attendees ?? [],
        conferenceUrl: row.conferenceUrl,
        conferenceProvider: row.conferenceProvider,
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
  priority?: number | null | undefined
  note?: string | null | undefined
  location?: string | null | undefined
  attendees?: readonly MeetingAttendee[] | null | undefined
  conferenceUrl?: string | null | undefined
  conferenceProvider?: string | null | undefined
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
      priority: input.priority ?? null,
      note: input.note ?? null,
      location: input.location ?? null,
      attendees:
        input.attendees === null || input.attendees === undefined ? null : [...input.attendees],
      conferenceUrl: input.conferenceUrl ?? null,
      conferenceProvider: input.conferenceProvider ?? null,
    })
    .returning()
  return first(rows)
}

/**
 * The meeting detail a series may have edited after the fact (issue #375). Deliberately narrow:
 * only what the user authored. **Attendees are absent on purpose** — they are third-party people
 * mirrored from a calendar, and we have no invite mechanism, so letting the app author a guest
 * list would store names nobody is ever told about.
 *
 * A field left out is untouched; a field set to `null` is cleared, so a wrong location can
 * actually be taken back rather than only overwritten.
 */
export interface UpdateSeriesInput {
  title?: string | undefined
  location?: string | null | undefined
  conferenceUrl?: string | null | undefined
  conferenceProvider?: string | null | undefined
  note?: string | null | undefined
}

/** Patch a series in the caller's workspace. Workspace-scoped by construction (ADR-0015). */
export async function updateSeries(
  db: Db,
  workspaceId: string,
  id: string,
  patch: UpdateSeriesInput,
): Promise<SeriesRow> {
  const set: Partial<typeof recurringEntries.$inferInsert> = {}
  if (patch.title !== undefined) set.title = patch.title
  if (patch.location !== undefined) set.location = patch.location
  if (patch.conferenceUrl !== undefined) set.conferenceUrl = patch.conferenceUrl
  if (patch.conferenceProvider !== undefined) set.conferenceProvider = patch.conferenceProvider
  if (patch.note !== undefined) set.note = patch.note
  if (Object.keys(set).length === 0) {
    // An empty patch is not an error, but it must not issue a no-column UPDATE.
    const rows = await db
      .select()
      .from(recurringEntries)
      .where(and(eq(recurringEntries.workspaceId, workspaceId), eq(recurringEntries.id, id)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new NotFoundError('series not found')
    return row
  }
  const rows = await db
    .update(recurringEntries)
    .set(set)
    .where(and(eq(recurringEntries.workspaceId, workspaceId), eq(recurringEntries.id, id)))
    .returning()
  const row = rows[0]
  if (!row) throw new NotFoundError('series not found')
  return row
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
