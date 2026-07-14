import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from '../hooks/useAsync.js'
import { type Client } from './projectsData.js'
import { apiBaseUrl } from '../config.js'

/**
 * The Projects data source (issue #11). The catalog is the live tracking catalog
 * when an API is configured, else **empty** — the app fabricates no clients or
 * projects. Production runs on real data only; with no backend a screen shows its
 * honest empty state. The catalog carries structure + rates only; spent/budget
 * figures are a Reports concern (computed via `packages/domain`). `live` lets the
 * UI flag that the data is API-backed.
 */
export interface CatalogResource extends AsyncResource<Client[]> {
  readonly live: boolean
}

export function useCatalog(): CatalogResource {
  const base = apiBaseUrl
  const resource = useAsync<Client[]>(
    () => (base !== null ? fetchCatalog(base) : Promise.resolve<Client[]>([])),
    `catalog:${base ?? 'empty'}`,
  )
  return { ...resource, live: base !== null }
}
