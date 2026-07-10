import { apiBaseUrl } from '../config.js'
import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from '../hooks/useAsync.js'
import { CLIENTS, type Client } from './projectsData.js'

/**
 * The Projects data source (issue #11): when an API base URL is configured the
 * hook fetches and assembles the live workspace catalog; otherwise — the default
 * in local dev and the test gate — it resolves the illustrative demo data. Screens
 * render the same `Client[]` shape either way and get loading / error / retry for
 * free. `live` lets the UI note it is showing demo data.
 */
export interface CatalogResource extends AsyncResource<Client[]> {
  readonly live: boolean
}

export function useCatalog(): CatalogResource {
  const base = apiBaseUrl
  const resource = useAsync<Client[]>(
    () => (base === null ? Promise.resolve([...CLIENTS]) : fetchCatalog(base)),
    base ?? 'demo',
  )
  return { ...resource, live: base !== null }
}
