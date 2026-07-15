import { apiBaseUrl } from '../config.js'
import {
  fetchBalance,
  fetchLedger,
  fetchUsage,
  type CreditEntry,
  type UsageBucket,
} from '../api/credits.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The AI-credit data source (REQ-027). When an API base URL is configured the hook
 * loads the balance, the ledger, and this-cycle usage from the `billing` credit
 * service and derives the this-cycle grant/spent totals from the cycle usage
 * window (never the all-time ledger tail); otherwise — the
 * default in local dev and the test gate — it resolves **empty**. The app
 * fabricates no credits. `live` lets the UI flag that the data is API-backed; the
 * numbers are the deterministic core's.
 */
export interface CreditsData {
  readonly balance: number
  readonly grantedTotal: number
  readonly spentTotal: number
  readonly ledger: readonly CreditEntry[]
  readonly usage: readonly UsageBucket[]
}

const EMPTY_CREDITS: CreditsData = {
  balance: 0,
  grantedTotal: 0,
  spentTotal: 0,
  ledger: [],
  usage: [],
}

export interface CreditsResource extends AsyncResource<CreditsData> {
  readonly live: boolean
}

/** The trailing 30-day usage window ending at the next UTC midnight. */
function cycleWindow(): { from: string; to: string } {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  to.setUTCDate(to.getUTCDate() + 1)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 30)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useCredits(): CreditsResource {
  const base = apiBaseUrl
  const resource = useAsync<CreditsData>(
    async () => {
      if (base === null) return EMPTY_CREDITS
      const range = cycleWindow()
      const [balance, ledger, usage] = await Promise.all([
        fetchBalance(base),
        fetchLedger(base, 50),
        fetchUsage(base, range),
      ])
      // "This cycle" figures must reflect the cycle, not the all-time ledger tail:
      // spent = the cycle-scoped usage sum, and the cycle's available credits are
      // what's left plus what was used (balance + spent). Deriving these from the
      // recent-ledger tail (any 50 rows across all time) overstated both.
      const spent = usage.reduce((s, u) => s + Math.max(0, u.credits), 0)
      const granted = balance + spent
      return { balance, grantedTotal: granted, spentTotal: spent, ledger, usage }
    },
    `${base ?? 'demo'}:credits`,
  )
  return { ...resource, live: base !== null }
}
