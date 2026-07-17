import {
  balanceRow,
  compareToBaseline,
  type BalanceRow,
  type BaselineComparison,
} from '@mydevtime/domain'

/**
 * Client glue for the Reports Balance row (REQ-058, design v14 §H). It shapes the user's own
 * tracked weekly totals into the deterministic `balanceRow` (Work / Protected / Free of waking
 * time, H1) and the `compareToBaseline` band (this week vs the person's **own** prior-weeks
 * normal, H3 — never a fixed threshold). The domain owns every figure (ADR-0005); this only
 * shapes the input and states the one assumption it must make.
 *
 * Protected/life minutes are 0 until the `life`/🛡 entry persistence lands (deferred, ADR-0066),
 * so the split is honest — Work vs Free — and the Protected segment grows once that data flows.
 */

/** The waking-time assumption, stated explicitly: 7 days × 16 waking hours. */
export const WAKING_MIN_PER_WEEK = 7 * 16 * 60

export interface WeeklyBalance {
  readonly row: BalanceRow
  /** This week's work against the person's own prior-weeks normal; null with < 4 prior weeks. */
  readonly band: BaselineComparison | null
}

/**
 * The Balance row + baseline band from the trailing weekly focus totals (oldest→newest, the
 * current week last). Returns `null` when there is no data at all (honest empty state).
 */
export function weeklyBalance(
  weeklyFocusMin: readonly number[],
  opts: { readonly protectedMin?: number; readonly wakingMin?: number } = {},
): WeeklyBalance | null {
  if (weeklyFocusMin.length === 0) return null
  const workMin = Math.max(0, weeklyFocusMin[weeklyFocusMin.length - 1] ?? 0)
  const history = weeklyFocusMin.slice(0, -1) // prior weeks = the personal baseline (H3)
  const row = balanceRow({
    workMin,
    protectedMin: Math.max(0, opts.protectedMin ?? 0),
    wakingMin: opts.wakingMin ?? WAKING_MIN_PER_WEEK,
  })
  return { row, band: compareToBaseline(workMin, history) }
}
