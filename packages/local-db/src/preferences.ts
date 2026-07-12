import type { LocalDb } from './port.js'
import { nowIso } from './ids.js'

/**
 * Preferences repository — per-workspace key/value settings (M10). Pure storage,
 * no interpretation: the caller decides what a value means (the app stores its
 * boolean toggles as `'1'`/`'0'`). Workspace-scoped like every other entity.
 */

/** All preference key→value pairs for the workspace. */
export async function getAllPreferences(
  db: LocalDb,
  workspaceId: string,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM preferences WHERE workspace_id = ?`,
    [workspaceId],
  )
  const out: Record<string, string> = {}
  for (const row of rows) out[row.key] = row.value
  return out
}

/** Upsert a single preference value. */
export async function setPreference(
  db: LocalDb,
  workspaceId: string,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO preferences (workspace_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [workspaceId, key, value, nowIso()],
  )
}
