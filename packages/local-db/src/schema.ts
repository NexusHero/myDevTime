export interface LocalDb {
  runAsync(sql: string, params?: any[]): Promise<{ insertId?: number; changes?: number }>
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>
  execAsync(sql: string): Promise<void>
}

/**
 * SQL statements that create the local SQLite schema.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  color          TEXT,
  client_name    TEXT,
  billable_default INTEGER NOT NULL DEFAULT 1,
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  billable_default INTEGER NOT NULL DEFAULT 1,
  archived       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id             TEXT PRIMARY KEY,
  project_id     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id        TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  started_at     TEXT NOT NULL,
  ended_at       TEXT,
  billable       INTEGER NOT NULL DEFAULT 1,
  source         TEXT NOT NULL DEFAULT 'timer',
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id             TEXT PRIMARY KEY,
  started_at     TEXT NOT NULL,
  ended_at       TEXT,
  break_ms       INTEGER NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'clock',
  break_shortfall_ms INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS absences (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  half_day       INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id             TEXT PRIMARY KEY,
  plan_date      TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'proposed',
  blocks         TEXT NOT NULL DEFAULT '[]',
  planned_focus_min INTEGER NOT NULL DEFAULT 0,
  unplaced_min   INTEGER NOT NULL DEFAULT 0,
  dropped_anchors TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preferences (
  key            TEXT PRIMARY KEY,
  value          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_entries (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  category       TEXT NOT NULL,
  reason         TEXT,
  at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
`
