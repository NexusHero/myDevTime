import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../../db/client.js'
import { exportRecords } from '../../../db/schema.js'
import type { ExportItem, ExportTargetPort } from './port.js'
import { runExport, type ExportRecord, type ExportRun } from './service.js'

/**
 * The Db-backed export ledger (REQ-035, ADR-0035): persistence around the pure `runExport`
 * runner. It supplies the runner's seen-set from previously **sent** rows (so a re-run
 * never double-posts) and records every outcome — one row per `(target, dedupeKey)`, kept
 * current in place rather than duplicated, and a `sent` row is never overwritten (it is
 * the audit proof the item landed). Every function takes a `workspaceId` non-optionally
 * and filters by it, so the ledger is workspace-isolated by construction (ADR-0015).
 */
export type ExportRecordRow = typeof exportRecords.$inferSelect

/** The workspace's export ledger, newest first. */
export function listExportRecords(
  db: Db,
  workspaceId: string,
  limit = 100,
): Promise<ExportRecordRow[]> {
  return db
    .select()
    .from(exportRecords)
    .where(eq(exportRecords.workspaceId, workspaceId))
    .orderBy(desc(exportRecords.createdAt), desc(exportRecords.id))
    .limit(limit)
}

/** Dedupe keys already **sent** to this target — the runner's idempotency seen-set. */
export async function sentKeys(db: Db, workspaceId: string, target: string): Promise<Set<string>> {
  const rows = await db
    .select({ dedupeKey: exportRecords.dedupeKey })
    .from(exportRecords)
    .where(
      and(
        eq(exportRecords.workspaceId, workspaceId),
        eq(exportRecords.target, target),
        eq(exportRecords.status, 'sent'),
      ),
    )
  return new Set(rows.map(r => r.dedupeKey))
}

/**
 * Persist a run's outcomes. One ledger row per `(target, dedupeKey)`: an existing row is
 * updated with the latest outcome instead of inserting a duplicate — except a `sent` row,
 * which is immutable (it proves the item already landed; a later `duplicate` verdict must
 * not erase the recorded external id).
 */
export async function recordOutcomes(
  db: Db,
  workspaceId: string,
  target: string,
  items: readonly ExportItem[],
  records: readonly ExportRecord[],
): Promise<void> {
  if (records.length === 0) return
  const labelByKey = new Map(items.map(i => [i.dedupeKey, i.title]))
  const keys = [...new Set(records.map(r => r.dedupeKey))]
  const existing = await db
    .select({
      id: exportRecords.id,
      dedupeKey: exportRecords.dedupeKey,
      status: exportRecords.status,
    })
    .from(exportRecords)
    .where(
      and(
        eq(exportRecords.workspaceId, workspaceId),
        eq(exportRecords.target, target),
        inArray(exportRecords.dedupeKey, keys),
      ),
    )
  const existingByKey = new Map(existing.map(r => [r.dedupeKey, r]))
  const handled = new Set<string>()
  for (const record of records) {
    // Within one run the first record per key is the meaningful one (a same-run repeat
    // is only ever the runner's own `duplicate` guard firing).
    if (handled.has(record.dedupeKey)) continue
    handled.add(record.dedupeKey)
    const values = {
      status: record.outcome,
      externalId: record.result?.externalId ?? null,
      url: record.result?.url ?? null,
      itemLabel: labelByKey.get(record.dedupeKey) ?? record.dedupeKey,
    }
    const prior = existingByKey.get(record.dedupeKey)
    if (prior !== undefined) {
      if (prior.status === 'sent') continue // audit rows are immutable
      await db.update(exportRecords).set(values).where(eq(exportRecords.id, prior.id))
    } else {
      await db
        .insert(exportRecords)
        .values({ workspaceId, target, dedupeKey: record.dedupeKey, ...values })
    }
  }
}

/**
 * Run an export for one workspace with the ledger wired in: previously sent keys feed the
 * runner's seen-set, and every outcome is recorded (an unavailable target is recorded
 * honestly as `unavailable` — nothing is silently dropped, ADR-0005).
 */
export async function runRecordedExport(
  db: Db,
  workspaceId: string,
  port: ExportTargetPort,
  target: string,
  items: readonly ExportItem[],
): Promise<ExportRun> {
  const seen = await sentKeys(db, workspaceId, target)
  const run = await runExport(port, items, seen)
  await recordOutcomes(db, workspaceId, target, items, run.records)
  return run
}
