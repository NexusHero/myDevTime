import {
  summarizeEntries,
  type TimeEntry as CoreEntry,
  type WorkspaceSummary,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { listEntries, type Entry } from './entries-service.js'

/**
 * Workspace time summary (REQ-005) — the read model behind the Reports screen.
 * The endpoint stays thin: fetch the window's entries, map the stored rows to the
 * core's absolute-instant `TimeEntry`, and let the deterministic `summarizeEntries`
 * compute every figure (ADR-0005). Money and budget ratios join later from the
 * rates/budget core; this is pure time.
 */
export interface SummaryQuery {
  readonly from: Date
  readonly to: Date
  readonly tz: string
  /** Count a running entry up to this instant; running entries are skipped if unset. */
  readonly asOf?: Date
}

function toCore(row: Entry): CoreEntry {
  return {
    id: row.id,
    start: row.startedAt.getTime(),
    end: row.endedAt === null ? null : row.endedAt.getTime(),
    billable: row.billable,
    source: row.source,
    ...(row.projectId === null ? {} : { projectId: row.projectId }),
    ...(row.taskId === null ? {} : { taskId: row.taskId }),
  }
}

export async function summarize(
  db: Db,
  workspaceId: string,
  query: SummaryQuery,
): Promise<WorkspaceSummary> {
  const rows = await listEntries(db, workspaceId, { from: query.from, to: query.to })
  const entries = rows.map(toCore)
  return summarizeEntries(entries, {
    tz: query.tz,
    ...(query.asOf === undefined ? {} : { asOf: query.asOf.getTime() }),
  })
}
