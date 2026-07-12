import { apiBaseUrl } from '../config.js'
import {
  fetchBalance,
  fetchLedger,
  fetchUsage,
  type CreditEntry,
  type UsageBucket,
} from '../api/credits.js'
import { useAsync, type AsyncResource } from './useAsync.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { getCreditBalance, listCreditEntries, getCreditUsage } from '@mydevtime/local-db'

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
  const db = useLocalDb()
  const resource = useAsync<CreditsData>(
    async () => {
      const range = cycleWindow()
      
      if (base !== null) {
        const [balance, ledger, usage] = await Promise.all([
          fetchBalance(base),
          fetchLedger(base, 50),
          fetchUsage(base, range),
        ])
        const { granted, spent } = totals(ledger)
        return { balance, grantedTotal: granted, spentTotal: spent, ledger, usage }
      }
      
      const [localBalance, localLedger, localUsage] = await Promise.all([
        getCreditBalance(db),
        listCreditEntries(db, 50),
        getCreditUsage(db, range.from, range.to),
      ])
      const { granted, spent } = totals(localLedger)
      return { 
        balance: localBalance, 
        grantedTotal: granted, 
        spentTotal: spent, 
        ledger: localLedger as CreditEntry[], 
        usage: localUsage 
      }
    },
    `${base ?? 'local-db'}:credits`,
  )
  return { ...resource, live: base !== null }
}
