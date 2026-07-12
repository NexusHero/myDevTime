import {
  createBudget,
  createClient,
  createProject,
  createRate,
  createTask,
  listProjects,
  type LocalDb,
} from '@mydevtime/local-db'
import { LOCAL_WORKSPACE_ID } from './context'

/** Default workspace hourly rate for a standalone store: €80/h (integer minor units). */
const DEFAULT_RATE_MINOR_PER_HOUR = 8000
const HOUR_MS = 3_600_000

/**
 * Seed a small starter catalog the first time the local store opens, so a
 * standalone user (no account, no backend) lands on a populated app rather than
 * an empty one — the offline equivalent of the old in-memory demo data. Idempotent:
 * it does nothing once any project exists.
 *
 * Structure (clients → projects → tasks) **plus** a default workspace rate and two
 * project budgets, so Reports can compute **real** money and budget figures from
 * the user's own tracked time (ADR-0040/0005) rather than showing fabricated
 * numbers — the figures start at zero and grow as time is tracked.
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

  // A workspace-default rate prices every billable entry; project budgets give the
  // Reports rings a target to fill as the user tracks time.
  await createRate(db, LOCAL_WORKSPACE_ID, {
    level: 'workspace',
    amountMinorPerHour: DEFAULT_RATE_MINOR_PER_HOUR,
  })
  await createBudget(db, LOCAL_WORKSPACE_ID, {
    scope: 'project',
    scopeId: finanzo.id,
    basis: 'hours',
    limitAmount: 40 * HOUR_MS, // 40h cap
    period: 'monthlyRecurring',
  })
  await createBudget(db, LOCAL_WORKSPACE_ID, {
    scope: 'project',
    scopeId: sync.id,
    basis: 'money',
    limitAmount: 500_000, // €5,000 cap
    period: 'total',
  })
}
