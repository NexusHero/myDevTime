import { apiBaseUrl } from '../config.js'
import { fetchCatalog } from '../api/tracking.js'
import { useAsync, type AsyncResource } from '../hooks/useAsync.js'
import { CLIENTS as DEMO_CLIENTS, type Client, type Project } from './projectsData.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import { listProjects, listTasks } from '@mydevtime/local-db'

export interface CatalogResource extends AsyncResource<Client[]> {
  readonly live: boolean
}

export function useCatalog(): CatalogResource {
  const base = apiBaseUrl
  const db = useLocalDb()
  const resource = useAsync<Client[]>(
    async () => {
      if (base !== null) return fetchCatalog(base)
      
      const localProjects = await listProjects(db)
      const clientsMap = new Map<string, Project[]>()
      
      for (const lp of localProjects) {
        const clientName = lp.clientName || 'Unknown Client'
        const localTasks = await listTasks(db, lp.id)
        
        const project: Project = {
          id: lp.id,
          name: lp.name,
          budgetMs: 0,
          spentMs: 0,
          rateMinorPerHour: 0,
          currency: 'EUR',
          tasks: localTasks.map(t => ({
            id: t.id,
            name: t.name,
            spentMs: 0,
            done: t.archived,
          })),
        }
        
        const existing = clientsMap.get(clientName) || []
        existing.push(project)
        clientsMap.set(clientName, existing)
      }
      
      const clients: Client[] = Array.from(clientsMap.entries()).map(([name, projects]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        projects,
      }))
      
      // If db is somehow empty before seed completes, fallback to demo
      if (clients.length === 0) return [...DEMO_CLIENTS]
      return clients
    },
    base ?? 'local-db-catalog',
  )
  return { ...resource, live: base !== null }
}
