import type { Money } from '../budgets/money.js'
import type { ProjectCost } from './finance.js'

/**
 * Reporting rollups for the Reports "Revenue & Budget" view (REQ-005, ADR-0005) —
 * pure money math on top of the per-project figures the billing core already
 * produces. Every amount stays integer minor units; nothing here fabricates a
 * number the deterministic core did not compute.
 */

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export interface ClientRevenue {
  /** `null` is the internal / client-less bucket. */
  readonly clientId: string | null
  readonly minor: Money
}

/**
 * Roll per-project revenue up to each project's client, most revenue first (ties by
 * client id for a stable order; `null` — internal — sorts last on a tie). Projects
 * with no mapped client fold into the `null` bucket.
 */
export function revenueByClient(
  byProject: readonly ProjectCost[],
  clientByProject: ReadonlyMap<string, string | null>,
): ClientRevenue[] {
  const byClient = new Map<string | null, Money>()
  for (const { projectId, costMinor } of byProject) {
    const clientId = clientByProject.get(projectId) ?? null
    byClient.set(clientId, (byClient.get(clientId) ?? 0) + costMinor)
  }
  return [...byClient.entries()]
    .map(([clientId, minor]) => ({ clientId, minor }))
    .sort((a, b) => b.minor - a.minor || (a.clientId ?? '￿').localeCompare(b.clientId ?? '￿'))
}

/**
 * The average effective hourly rate = billable revenue ÷ billable hours, in minor
 * units per hour (rounded). `null` when there is no billable time to divide by, so
 * the caller shows an honest "—" instead of a divide-by-zero figure.
 */
export function effectiveRateMinorPerHour(billableMinor: Money, billableMs: number): number | null {
  if (billableMs <= 0) return null
  return Math.round(billableMinor / (billableMs / HOUR_MS))
}

export interface OpenItem {
  /** The entry's start instant (its age is measured from here). */
  readonly startMs: number
  readonly amountMinor: Money
  readonly durationMs: number
}

export type AgingKey = 'recent' | 'mid' | 'old'

export interface AgingBucket {
  readonly key: AgingKey
  readonly minor: Money
  readonly ms: number
}

export interface AgingReport {
  /** Always three buckets, in order `recent → mid → old`. */
  readonly buckets: readonly AgingBucket[]
  readonly totalMinor: Money
  readonly totalMs: number
}

export interface AgingOptions {
  /** Upper bound (days, inclusive) of the "recent" bucket. Default 30. */
  readonly recentDays?: number
  /** Upper bound (days, inclusive) of the "mid" bucket. Default 60. */
  readonly midDays?: number
}

/**
 * Bucket open (un-invoiced) billable amounts by age at `asOfMs`: `recent` (≤ 30 d),
 * `mid` (≤ 60 d), `old` (older) — boundaries inclusive on the lower bucket. Age is
 * measured from each item's start; anything not older than "recent" (incl. a future
 * start) lands in `recent`. Older debt is hardest to collect, so surfacing it is the
 * point of the split.
 */
export function agingBuckets(
  items: readonly OpenItem[],
  asOfMs: number,
  opts: AgingOptions = {},
): AgingReport {
  const recentDays = opts.recentDays ?? 30
  const midDays = opts.midDays ?? 60
  const acc: Record<AgingKey, { minor: Money; ms: number }> = {
    recent: { minor: 0, ms: 0 },
    mid: { minor: 0, ms: 0 },
    old: { minor: 0, ms: 0 },
  }
  for (const it of items) {
    const ageDays = (asOfMs - it.startMs) / DAY_MS
    const key: AgingKey = ageDays <= recentDays ? 'recent' : ageDays <= midDays ? 'mid' : 'old'
    acc[key].minor += it.amountMinor
    acc[key].ms += it.durationMs
  }
  const keys: readonly AgingKey[] = ['recent', 'mid', 'old']
  const buckets = keys.map(key => ({ key, minor: acc[key].minor, ms: acc[key].ms }))
  return {
    buckets,
    totalMinor: buckets.reduce((n, b) => n + b.minor, 0),
    totalMs: buckets.reduce((n, b) => n + b.ms, 0),
  }
}
