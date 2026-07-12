export type { LocalDb, Row, SqlValue } from './port.js'
export { toBool, fromBool } from './port.js'
export { newId, nowIso } from './ids.js'
export { SCHEMA_SQL, ensureSchema } from './schema.js'
export {
  type LocalTimeEntry,
  type StartEntryInput,
  getRunningEntry,
  listEntries,
  listEntriesInRange,
  startEntry,
  stopRunningEntry,
  deleteEntry,
} from './entries.js'
export {
  type LocalProject,
  type LocalTask,
  type LocalClient,
  type CreateProjectInput,
  listProjects,
  createProject,
  listTasks,
  listAllTasks,
  createTask,
  listClients,
  createClient,
} from './catalog.js'
export {
  type LocalRate,
  type RateLevel,
  type CreateRateInput,
  listRates,
  createRate,
} from './rates.js'
export {
  type LocalBudget,
  type BudgetScope,
  type BudgetBasis,
  type BudgetPeriod,
  type CreateBudgetInput,
  listBudgets,
  createBudget,
} from './budgets.js'
export { getAllPreferences, setPreference } from './preferences.js'
export {
  type OutboxOp,
  type EnqueueOpInput,
  enqueueOp,
  listPendingOps,
  acknowledgeOps,
} from './outbox.js'
export { type SyncState, getSyncState, setWatermark } from './syncState.js'
export { applyServerChange } from './syncMapping.js'
export {
  type SyncPushChange,
  type SyncConflict,
  type SyncPushResult,
  type SyncPullChange,
  type SyncPullResponse,
  type SyncTransport,
  type SyncOutcome,
  runSync,
} from './sync.js'
