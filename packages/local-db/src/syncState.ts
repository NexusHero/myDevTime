import type { LocalDb, Row } from './port.js'
import { newId } from './ids.js'

/**
 * Per-workspace sync bookkeeping (REQ-006, ADR-0019): the **watermark** (highest
 * server version already applied locally, so a pull resumes from where it left
 * off) and this device's stable **device_id** (the deterministic last-writer-wins
 * tie-break when two edits share an `updatedAt`). The row is created lazily on
 * first read with a fresh device id; the id never changes afterwards.
 */
export interface SyncState {
  readonly workspaceId: string
  readonly watermark: number
  readonly deviceId: string
}

function toState(row: Row): SyncState {
  return {
    workspaceId: String(row.workspace_id),
    watermark: Number(row.watermark),
    deviceId: String(row.device_id),
  }
}

/** The workspace's sync state, creating it (watermark 0 + a fresh device id) on first read. */
export async function getSyncState(db: LocalDb, workspaceId: string): Promise<SyncState> {
  const existing = await db.getFirstAsync(
    `SELECT workspace_id, watermark, device_id FROM sync_state WHERE workspace_id = ?`,
    [workspaceId],
  )
  if (existing) return toState(existing)

  const deviceId = newId()
  await db.runAsync(
    `INSERT INTO sync_state (workspace_id, watermark, device_id) VALUES (?, 0, ?)`,
    [workspaceId, deviceId],
  )
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
  await db.runAsync(`UPDATE sync_state SET watermark = ? WHERE workspace_id = ?`, [
    watermark,
    workspaceId,
  ])
}
