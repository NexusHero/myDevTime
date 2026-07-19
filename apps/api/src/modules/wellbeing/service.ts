import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { wellbeingDays } from '../../db/wellbeing-schema.js'

/**
 * Wellbeing persistence (REQ-065, ADR-0010/0015): the per-day load history the Evening Companion's
 * longitudinal baseline is calibrated over. The service stays thin — it upserts one deterministic
 * `loadScore` per person per local day and reads the recent series back — and hands the numbers to
 * the pure `computeBaseline` core; no wellbeing arithmetic happens here (ADR-0005). Every API takes a
 * `workspaceId` non-optionally, so reads and writes are workspace-isolated by construction (negative
 * isolation is proven in the integration tests). Registered directly on `./wellbeing-schema.js` — the
 * `db/schema.js` barrel export + the migration are added centrally by the lead.
 */

/** The workspace + user + local day (`'YYYY-MM-DD'`) that scopes one day's load. */
export interface DayLoadKey {
  readonly workspaceId: string
  readonly userId: string
  readonly day: string
}

export interface RecordDayLoadInput extends DayLoadKey {
  /** The deterministic composite day-load score from `reviewDay` (code's number, ADR-0005). */
  readonly loadScore: number
}

/** The workspace + user a history read is scoped to. */
export interface DayLoadScope {
  readonly workspaceId: string
  readonly userId: string
}

/** One past day for the baseline: its persisted load score plus the weekday it fell on (0–6). */
export interface LoadHistoryDay {
  readonly loadScore: number
  readonly weekday: number
}

/**
 * Weekday index (0 = Sunday … 6 = Saturday) of a `'YYYY-MM-DD'` day, derived clock-free from the
 * stored string. `computeBaseline` only groups by weekday, so any stable 0–6 encoding is fine.
 */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay()
}

/**
 * Record (upsert) the day's deterministic load score for a person. The unique (workspace, user, day)
 * index makes a repeated evening open overwrite the day rather than double-count it — so the baseline
 * reads each day exactly once and the companion is idempotent. Workspace-scoped by construction.
 */
export async function recordDayLoad(db: Db, input: RecordDayLoadInput): Promise<void> {
  await db
    .insert(wellbeingDays)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      day: input.day,
      loadScore: input.loadScore,
    })
    .onConflictDoUpdate({
      target: [wellbeingDays.workspaceId, wellbeingDays.userId, wellbeingDays.day],
      set: { loadScore: input.loadScore },
    })
}

/**
 * The person's own recent load history (up to `days` most-recent days), oldest→newest — the exact
 * series `computeBaseline` consumes. Scoped to the caller's workspace **and** user, so no other
 * workspace's (or teammate's) days ever leak into the baseline.
 */
export async function recentLoadHistory(
  db: Db,
  scope: DayLoadScope,
  days: number,
): Promise<LoadHistoryDay[]> {
  // Newest-first for the LIMIT window, then reversed to the oldest→newest order the baseline expects.
  const rows = await db
    .select({ day: wellbeingDays.day, loadScore: wellbeingDays.loadScore })
    .from(wellbeingDays)
    .where(
      and(eq(wellbeingDays.workspaceId, scope.workspaceId), eq(wellbeingDays.userId, scope.userId)),
    )
    .orderBy(desc(wellbeingDays.day), asc(wellbeingDays.id))
    .limit(days)
  return rows.map(r => ({ loadScore: r.loadScore, weekday: weekdayOf(r.day) })).reverse()
}

/**
 * The injectable wellbeing service the `ai` module provides to the Evening Companion endpoint. It is a
 * thin, stateless port over the workspace-scoped functions above; the per-request `Db` handle is
 * passed in (resolved from the authenticated caller, never a client-supplied id).
 */
@Injectable()
export class WellbeingService {
  recordDayLoad(db: Db, input: RecordDayLoadInput): Promise<void> {
    return recordDayLoad(db, input)
  }

  recentLoadHistory(db: Db, scope: DayLoadScope, days: number): Promise<LoadHistoryDay[]> {
    return recentLoadHistory(db, scope, days)
  }
}
