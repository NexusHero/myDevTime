import { listAllTasks, listClients, listProjects, type LocalDb } from '@mydevtime/local-db'
import { apiBaseUrl } from '../config.js'
import { assembleCatalog, fetchCatalog } from '../api/tracking.js'
import { LOCAL_WORKSPACE_ID, useLocalDb } from '../localDb/context.js'
import { useAsync, type AsyncResource } from '../hooks/useAsync.js'
import { CLIENTS, type Client } from './projectsData.js'

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

/** Assemble `Client[]` from the local store via the shared `assembleCatalog`. */
async function assembleFromLocal(db: LocalDb): Promise<Client[]> {
  const [clients, projects, tasks] = await Promise.all([
    listClients(db, LOCAL_WORKSPACE_ID),
    listProjects(db, LOCAL_WORKSPACE_ID),
    listAllTasks(db, LOCAL_WORKSPACE_ID),
  ])
  return assembleCatalog(
    clients.map(c => ({ id: c.id, name: c.name })),
    projects.map(p => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      hourlyRateOverride: null,
    })),
    tasks.map(t => ({ id: t.id, name: t.name, projectId: t.projectId, archived: t.archived })),
  )
}

export function useCatalog(): CatalogResource {
  const base = apiBaseUrl
  const db = useLocalDb()
  const resource = useAsync<Client[]>(
    () => {
      if (base !== null) return fetchCatalog(base)
      if (db !== null) return assembleFromLocal(db)
      return Promise.resolve([...CLIENTS])
    },
    base ?? (db !== null ? 'local-db' : 'demo'),
  )
  return { ...resource, live: base !== null }
}
