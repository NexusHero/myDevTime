import { useEffect, useState } from 'react'
import { burndownProjection, type BurndownProjection } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { fetchBudgetBurndown, type BudgetBurndownData } from '../api/budgets.js'

export interface BudgetBurndownResource {
  readonly data: BudgetBurndownData | null
  /** The deterministic exhaustion projection over the fetched points, or null with no data. */
  readonly projection: BurndownProjection | null
  readonly loading: boolean
}

/**
 * The burn-down trajectory for one budget (REQ-005, design v10). Fetches the server's
 * cumulative-consumption samples for `budgetId` (the client picks the most-committed
 * budget), then runs the **deterministic** `burndownProjection` (ADR-0005) to extrapolate
 * when it runs out — the number is the core's, never fabricated. Idle (null) when no
 * budget id is given or no API is configured; refetches when the id changes.
 */
export function useBudgetBurndown(budgetId: string | null): BudgetBurndownResource {
  const base = apiBaseUrl
  const [data, setData] = useState<BudgetBurndownData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (base === null || budgetId === null) {
      setData(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    fetchBudgetBurndown(base, budgetId)
      .then(d => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setData(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base, budgetId])

  const projection =
    data === null
      ? null
      : burndownProjection(
          data.points.map(p => ({ at: p.atMs, consumed: p.consumed })),
          data.budget.limitAmount,
        )

  return { data, projection, loading }
}
