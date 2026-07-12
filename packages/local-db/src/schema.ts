import type { LocalDb } from './port.js'

/**
 * The local SQLite schema (ADR-0040). It **mirrors the server schema** — same
 * table/column names — and, crucially, carries the sync/tenancy columns on every
 * syncable entity from day one: `workspace_id` (the isolation root, never
 * optional), `version`, `updated_at`, `deleted_at` (tombstone), `device_id` and
 * `operation_id`. "Standalone" runs with a single synthetic `workspace_id` and
 * sync off; "team" turns sync on against the same schema — no fork, no on-device
 * migration later (the exact trap PR #172's schema fell into).
 *
 * TEXT primary keys (client UUIDs), ISO-8601 TEXT timestamps (one format
 * everywhere), INTEGER 0/1 for booleans. Indexes cover the isolation filter
 * (`workspace_id`) and the common sort/lookup keys — this also folds in the
 * "SQLite indexes" idea from PR #173, on the correct schema.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_clients_ws ON clients(workspace_id);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id    TEXT,
  name         TEXT NOT NULL,
  color        TEXT,
  billable_default INTEGER NOT NULL DEFAULT 1,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_ws ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  billable_default INTEGER NOT NULL DEFAULT 1,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id   TEXT,
  task_id      TEXT,
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  billable     INTEGER NOT NULL DEFAULT 1,
  source       TEXT NOT NULL DEFAULT 'timer',
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_ws_started ON time_entries(workspace_id, started_at);
CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_entries_task ON time_entries(task_id);
-- At most one live running timer per workspace (a tombstoned row is exempt).
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_one_running_per_ws
  ON time_entries(workspace_id)
  WHERE ended_at IS NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rates (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  -- 'workspace' | 'client' | 'project' | 'task'
  level        TEXT NOT NULL,
  -- the client/project/task id this rate applies to; NULL for the workspace default
  scope_id     TEXT,
  -- integer minor units per hour
  amount_minor_per_hour INTEGER NOT NULL,
  -- inclusive instant from which this rate applies (effective-dated, non-retroactive)
  effective_from TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_rates_ws ON rates(workspace_id);

CREATE TABLE IF NOT EXISTS budgets (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  -- 'project' | 'client'
  scope        TEXT NOT NULL,
  scope_id     TEXT NOT NULL,
  -- 'hours' | 'money'
  basis        TEXT NOT NULL,
  -- cap: milliseconds for hours-based, integer minor units for money-based
  limit_amount INTEGER NOT NULL,
  -- 'total' | 'monthlyRecurring'
  period       TEXT NOT NULL,
  -- JSON array of alert ratios, e.g. [0.8, 1]
  thresholds   TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_budgets_ws ON budgets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_budgets_scope ON budgets(workspace_id, scope, scope_id);

CREATE TABLE IF NOT EXISTS shifts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  break_ms     INTEGER NOT NULL DEFAULT 0,
  break_shortfall_ms INTEGER NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'clock',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_shifts_ws_started ON shifts(workspace_id, started_at);

CREATE TABLE IF NOT EXISTS absences (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind         TEXT NOT NULL,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  half_day     INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_absences_ws_start ON absences(workspace_id, start_date);

CREATE TABLE IF NOT EXISTS credit_entries (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind         TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  category     TEXT NOT NULL,
  reason       TEXT,
  at           TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  device_id    TEXT,
  operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_credits_ws_at ON credit_entries(workspace_id, at);

CREATE TABLE IF NOT EXISTS preferences (
  workspace_id TEXT NOT NULL,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 0,
  device_id    TEXT,
  operation_id TEXT,
  PRIMARY KEY (workspace_id, key)
);

-- The client change-log (ADR-0019 client half): one row per local mutation,
-- carrying the op_id (idempotency), the base server version + snapshot it was
-- edited from (NULL = an offline insert), and the full EntityState to push. Rows
-- are removed once the server acks them. Append-only; standalone mode never writes
-- here (sync off).
CREATE TABLE IF NOT EXISTS sync_outbox (
  op_id          TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  base_version   INTEGER,
  base_state     TEXT,
  incoming_state TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_ws ON sync_outbox(workspace_id, created_at);

-- Per-workspace sync bookkeeping: the pull watermark (last server version applied)
-- and this device's stable id (the deterministic LWW tie-break, ADR-0019).
CREATE TABLE IF NOT EXISTS sync_state (
  workspace_id TEXT PRIMARY KEY,
  watermark    INTEGER NOT NULL DEFAULT 0,
  device_id    TEXT NOT NULL
);
`

/** Create every table + index if it does not already exist. Idempotent. */
export async function ensureSchema(db: LocalDb): Promise<void> {
  await db.execAsync(SCHEMA_SQL)
}
