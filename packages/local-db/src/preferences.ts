import { eq } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { preferences } from './tables.js'
import { nowIso } from './ids.js'

/**
 * Preferences repository — per-workspace key/value settings (M10). Pure storage,
 * no interpretation: the caller decides what a value means (the app stores its
 * boolean toggles as `'1'`/`'0'`). Workspace-scoped like every other entity;
 * queried through Drizzle (ADR-0046).
 */

/** All preference key→value pairs for the workspace. */
export async function getAllPreferences(
  db: LocalDb,
  workspaceId: string,
): Promise<Record<string, string>> {
  const rows = await drizzleFor(db)
    .select({ key: preferences.key, value: preferences.value })
    .from(preferences)
    .where(eq(preferences.workspaceId, workspaceId))
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
  const now = nowIso()
  await drizzleFor(db)
    .insert(preferences)
    .values({ workspaceId, key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: [preferences.workspaceId, preferences.key],
      set: { value, updatedAt: now },
    })
}
