import { eq } from 'drizzle-orm'
import type { LocalDb } from './port.js'
import { drizzleFor } from './db.js'
import { syncState } from './tables.js'
import { newId } from './ids.js'

/**
 * Per-workspace sync bookkeeping (REQ-006, ADR-0019): the **watermark** (highest
 * server version already applied locally, so a pull resumes from where it left
 * off) and this device's stable **device_id** (the deterministic last-writer-wins
 * tie-break when two edits share an `updatedAt`). The row is created lazily on
 * first read with a fresh device id; the id never changes afterwards. Queried
 * through Drizzle (ADR-0046).
 */
export interface SyncState {
  readonly workspaceId: string
  readonly watermark: number
  readonly deviceId: string
}

/** The workspace's sync state, creating it (watermark 0 + a fresh device id) on first read. */
export async function getSyncState(db: LocalDb, workspaceId: string): Promise<SyncState> {
  const d = drizzleFor(db)
  const rows = await d
    .select()
    .from(syncState)
    .where(eq(syncState.workspaceId, workspaceId))
    .limit(1)
  const existing = rows[0]
  if (existing) return existing

  const deviceId = newId()
  await d.insert(syncState).values({ workspaceId, watermark: 0, deviceId })
  return { workspaceId, watermark: 0, deviceId }
}

/** Advance (persist) the pull watermark. The device id is left untouched. */
export async function setWatermark(
  db: LocalDb,
  workspaceId: string,
  watermark: number,
): Promise<void> {
  // Ensure the row (and its device id) exists before updating.
  await getSyncState(db, workspaceId)
  await drizzleFor(db)
    .update(syncState)
    .set({ watermark })
    .where(eq(syncState.workspaceId, workspaceId))
}
