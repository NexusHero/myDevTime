import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { userPreferences } from '../../db/schema.js'
import { DEFAULT_PREFERENCES, mergePreferences, type Preferences } from './preferences.js'

/**
 * Preference persistence (M10): read the caller's stored toggles merged onto the
 * defaults, and upsert a patch. Workspace-scoped by construction — every query is
 * keyed by both `workspaceId` and `userId`, so one user's settings can never leak
 * to another workspace. The merge is the pure, tested `mergePreferences`.
 */
export async function getPreferences(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<Preferences> {
  const rows = await db
    .select({ prefs: userPreferences.prefs })
    .from(userPreferences)
    .where(and(eq(userPreferences.workspaceId, workspaceId), eq(userPreferences.userId, userId)))
    .limit(1)
  return mergePreferences(DEFAULT_PREFERENCES, rows[0]?.prefs ?? {})
}

/** Apply a (partial) patch and return the full, merged preferences. */
export async function setPreferences(
  db: Db,
  workspaceId: string,
  userId: string,
  patch: unknown,
): Promise<Preferences> {
  const current = await getPreferences(db, workspaceId, userId)
  const next = mergePreferences(current, patch)
  const blob: Record<string, boolean> = { ...next } // the jsonb column shape
  await db
    .insert(userPreferences)
    .values({ workspaceId, userId, prefs: blob, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userPreferences.workspaceId, userPreferences.userId],
      set: { prefs: blob, updatedAt: new Date() },
    })
  return next
}
