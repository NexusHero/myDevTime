import { aggregate } from '../tracking/aggregation.js'
import type { TimeEntry } from '../tracking/time-entry.js'
import type { DurationMs, Instant, TimeZone } from '../tracking/time.js'

/**
 * Workspace time summary (REQ-005/009, ADR-0005) — the deterministic report the
 * Reports screen renders. Built on the exhaustively tested `aggregate` (daily
 * buckets grouped by project), it exposes workspace totals, a billable split, and
 * one shared day axis so every project's `daily` series lines up for a sparkline.
 * Money and budget ratios are not here — those join the rates/budget core in a
 * later slice; this stays pure time.
 */
export interface ProjectSummary {
  readonly projectId: string
  readonly spentMs: DurationMs
  readonly billableMs: DurationMs
  /** Tracked ms per day, aligned index-for-index with `WorkspaceSummary.days`. */
  readonly daily: readonly DurationMs[]
}

export interface WorkspaceSummary {
  readonly totalMs: DurationMs
  readonly billableMs: DurationMs
  /** Ascending, distinct `YYYY-MM-DD` keys for the days that had activity. */
  readonly days: readonly string[]
  /** Projects with tracked time, most tracked first. */
  readonly byProject: readonly ProjectSummary[]
}

export interface SummaryOptions {
  readonly tz: TimeZone
  /** 1 = Monday … 7 = Sunday; forwarded to weekly logic if ever needed. */
  readonly weekStartsOn?: number
  /** Count running entries up to this instant; running entries are skipped if unset. */
  readonly asOf?: Instant
}

const NO_PROJECT = '(none)'

interface MutableProjectSummary {
  projectId: string
  spentMs: DurationMs
  billableMs: DurationMs
  daily: DurationMs[]
}

export function summarizeEntries(
  entries: readonly TimeEntry[],
  opts: SummaryOptions,
): WorkspaceSummary {
  const buckets = aggregate(entries, {
    tz: opts.tz,
    granularity: 'day',
    groupBy: 'project',
    ...(opts.weekStartsOn === undefined ? {} : { weekStartsOn: opts.weekStartsOn }),
    ...(opts.asOf === undefined ? {} : { asOf: opts.asOf }),
  })

  const days = [...new Set(buckets.map(b => b.period))].sort()
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  const byId = new Map<string, MutableProjectSummary>()
  let totalMs = 0
  let billableMs = 0

  for (const bucket of buckets) {
    const projectId = bucket.group ?? NO_PROJECT
    const summary = byId.get(projectId) ?? {
      projectId,
      spentMs: 0,
      billableMs: 0,
      daily: days.map(() => 0),
    }
    summary.spentMs += bucket.totalMs
    summary.billableMs += bucket.billableMs
    const idx = dayIndex.get(bucket.period) ?? 0
    summary.daily[idx] = (summary.daily[idx] ?? 0) + bucket.totalMs
    byId.set(projectId, summary)
    totalMs += bucket.totalMs
    billableMs += bucket.billableMs
  }

  const byProject = [...byId.values()].sort(
    (a, b) => b.spentMs - a.spentMs || a.projectId.localeCompare(b.projectId),
  )

  return { totalMs, billableMs, days, byProject }
}
