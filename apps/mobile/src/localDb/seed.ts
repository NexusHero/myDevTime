import {
  createClient,
  createProject,
  createTask,
  listProjects,
  type LocalDb,
} from '@mydevtime/local-db'
import { LOCAL_WORKSPACE_ID } from './context'

/**
 * Seed a small starter catalog the first time the local store opens, so a
 * standalone user (no account, no backend) lands on a populated app rather than
 * an empty one — the offline equivalent of the old in-memory demo data. Idempotent:
 * it does nothing once any project exists. Structure only (clients → projects →
 * tasks); spent/budget stay a Reports concern computed via `packages/domain`.
 */
export async function seedIfEmpty(db: LocalDb): Promise<void> {
  const existing = await listProjects(db, LOCAL_WORKSPACE_ID)
  if (existing.length > 0) return

  const acme = await createClient(db, LOCAL_WORKSPACE_ID, 'Finanzo AG')
  const nordwind = await createClient(db, LOCAL_WORKSPACE_ID, 'Nordwind GmbH')

  const finanzo = await createProject(db, LOCAL_WORKSPACE_ID, {
    name: 'Finanzo',
    clientId: acme.id,
    color: '#2563eb',
  })
  const sync = await createProject(db, LOCAL_WORKSPACE_ID, {
    name: 'Sync engine',
    clientId: acme.id,
    color: '#00937c',
  })
  await createProject(db, LOCAL_WORKSPACE_ID, {
    name: 'Website relaunch',
    clientId: nordwind.id,
    color: '#bd7122',
  })

  await createTask(db, LOCAL_WORKSPACE_ID, finanzo.id, 'Conflict resolution')
  await createTask(db, LOCAL_WORKSPACE_ID, finanzo.id, 'Reports')
  await createTask(db, LOCAL_WORKSPACE_ID, sync.id, 'Delta protocol')
}
