import { apiBaseUrl } from '../config.js'
import { createRate, deleteRate, fetchRates, type NewRate, type Rate } from '../api/rates.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The hourly-rate source (REQ-005). When an API base URL is configured the hook
 * lists the workspace's rate rules from the `billing` module and creates/deletes
 * them there; otherwise — the default in local dev and the test gate — it resolves
 * **empty** (and the mutators are inert). The app fabricates no rates. `live` lets
 * the UI flag that the data is API-backed. The rates are the server's; the client
 * only lists and posts.
 */
export interface RatesResource extends AsyncResource<Rate[]> {
  readonly live: boolean
  readonly create: (rate: NewRate) => Promise<void>
  readonly remove: (id: string) => Promise<void>
}

export function useRates(): RatesResource {
  const base = apiBaseUrl
  const resource = useAsync<Rate[]>(
    () => (base !== null ? fetchRates(base) : Promise.resolve<Rate[]>([])),
    base !== null ? `rates:${base}` : 'rates:empty',
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
