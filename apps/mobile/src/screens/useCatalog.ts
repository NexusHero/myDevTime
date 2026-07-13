import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from '../hooks/useAsync.js'
import { CLIENTS, type Client } from './projectsData.js'
import { apiBaseUrl } from '../config.js'

/**
 * The Projects data source (issue #11). Three modes behind one `Client[]` shape:
 * - **API** (`apiBaseUrl` set): fetch + assemble the live catalog.
 * - **Offline** (`apiBaseUrl` null, local DB open): assemble the catalog from the
 *   local SQLite store (ADR-0040), reusing the same tested `assembleCatalog`.
 * - **Demo** (no DB open yet, e.g. the test gate): the illustrative fixtures.
 * The catalog carries structure + rates only; spent/budget figures are a Reports
 * concern (computed via `packages/domain`), so this hook fabricates no numbers.
 * `live` lets the UI flag non-API data.
 */
export interface CatalogResource extends AsyncResource<Client[]> {
  readonly live: boolean
}

export function useCatalog(): CatalogResource {
  const base = apiBaseUrl
  const resource = useAsync<Client[]>(() => {
    if (base !== null) return fetchCatalog(base)
    return Promise.resolve([...CLIENTS])
  }, base ?? 'demo')
  return { ...resource, live: base !== null }
}
