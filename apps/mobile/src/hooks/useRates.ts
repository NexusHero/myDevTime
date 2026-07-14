import { apiBaseUrl } from '../config.js'
import { createRate, deleteRate, fetchRates, type NewRate, type Rate } from '../api/rates.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The hourly-rate source (REQ-005). When an API base URL is configured the hook
 * lists the workspace's rate rules from the `billing` module and creates/deletes
 * them there; otherwise — the default in local dev and the test gate — it resolves
 * an illustrative demo set (and the mutators are inert). `live` lets the UI flag
 * demo data. The rates are the server's; the client only lists and posts.
 */
const DEMO_RATES: readonly Rate[] = [
  {
    id: 'demo-workspace',
    level: 'workspace',
    scopeId: null,
    amountMinorPerHour: 9000,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-project',
    level: 'project',
    scopeId: 'finanzo',
    amountMinorPerHour: 12000,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
  },
]

export interface RatesResource extends AsyncResource<Rate[]> {
  readonly live: boolean
  readonly create: (rate: NewRate) => Promise<void>
  readonly remove: (id: string) => Promise<void>
}

export function useRates(): RatesResource {
  const base = apiBaseUrl
  const resource = useAsync<Rate[]>(
    () => (base !== null ? fetchRates(base) : Promise.resolve([...DEMO_RATES])),
    base ?? 'rates-demo',
  )
  const create = async (rate: NewRate): Promise<void> => {
    if (base === null) return
    await createRate(base, rate)
    resource.reload()
  }
  const remove = async (id: string): Promise<void> => {
    if (base === null) return
    await deleteRate(base, id)
    resource.reload()
  }
  return { ...resource, live: base !== null, create, remove }
}
