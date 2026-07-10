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
 * service and derives the grant/spent totals from the ledger; otherwise — the
 * default in local dev and the test gate — it resolves illustrative demo figures.
 * `live` lets the UI flag demo data. The numbers are the deterministic core's.
 */
export interface CreditsData {
  readonly balance: number
  readonly grantedTotal: number
  readonly spentTotal: number
  readonly ledger: readonly CreditEntry[]
  readonly usage: readonly UsageBucket[]
}

export interface CreditsResource extends AsyncResource<CreditsData> {
  readonly live: boolean
}

function totals(ledger: readonly CreditEntry[]): {
  balance: number
  granted: number
  spent: number
} {
  let granted = 0
  let spent = 0
  for (const e of ledger) {
    if (e.amount >= 0) granted += e.amount
    else spent += -e.amount
  }
  return { balance: granted - spent, granted, spent }
}

function demoCredits(): CreditsData {
  const at = (d: number): string => `2026-07-${String(d).padStart(2, '0')}T09:00:00.000Z`
  const ledger: CreditEntry[] = [
    {
      id: 'l1',
      kind: 'grant',
      amount: 500,
      category: 'monthly-grant',
      reason: 'Monthly Pro grant',
      at: at(1),
    },
    {
      id: 'l2',
      kind: 'debit',
      amount: -8,
      category: 'meeting-insights',
      reason: 'Finanzo review',
      at: at(7),
    },
    { id: 'l3', kind: 'debit', amount: -4, category: 'nl-entry', reason: null, at: at(8) },
    {
      id: 'l4',
      kind: 'debit',
      amount: -1,
      category: 'assistant',
      reason: 'Budget question',
      at: at(8),
    },
    {
      id: 'l5',
      kind: 'debit',
      amount: -2,
      category: 'co-planner',
      reason: 'Day proposal',
      at: at(9),
    },
  ]
  const { balance, granted, spent } = totals(ledger)
  return {
    balance,
    grantedTotal: granted,
    spentTotal: spent,
    ledger,
    usage: [
      { category: 'meeting-insights', credits: 8 },
      { category: 'nl-entry', credits: 4 },
      { category: 'co-planner', credits: 2 },
      { category: 'assistant', credits: 1 },
    ],
  }
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
      if (base === null) return demoCredits()
      const range = cycleWindow()
      const [balance, ledger, usage] = await Promise.all([
        fetchBalance(base),
        fetchLedger(base, 50),
        fetchUsage(base, range),
      ])
      const { granted, spent } = totals(ledger)
      return { balance, grantedTotal: granted, spentTotal: spent, ledger, usage }
    },
    `${base ?? 'demo'}:credits`,
  )
  return { ...resource, live: base !== null }
}
