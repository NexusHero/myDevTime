import type { Instant, DurationMs } from './time.js'

/**
 * Provenance of an entry (ADR-0005 "provenance everywhere"). The rules engine
 * uses `rule:<id>@<version>`; kept as a free string for that case.
 */
export type EntrySource = 'timer' | 'manual' | 'calendar' | 'ai-proposal' | (string & {})

/**
 * A time entry — the raw, exact record. Instants are absolute (UTC epoch ms);
 * entries are never stored in local time (REQ-003). `end === null` means the
 * timer is still running.
 */
export interface TimeEntry {
  readonly id: string
  readonly start: Instant
  readonly end: Instant | null
  readonly billable: boolean
  readonly source: EntrySource
  readonly projectId?: string
  readonly taskId?: string
  readonly clientId?: string
  readonly tags?: readonly string[]
  readonly note?: string
}

export function isRunning(entry: TimeEntry): boolean {
  return entry.end === null
}

/**
 * Exact duration of an entry. A running entry is measured up to `asOf`; passing
 * no `asOf` for a running entry is a programming error (keeps the core pure — it
 * never reads the clock itself).
 */
export function entryDuration(entry: TimeEntry, asOf?: Instant): DurationMs {
  const end = entry.end ?? asOf
  if (end === undefined) {
    throw new Error('entryDuration: a running entry requires an `asOf` instant')
  }
  const ms = end - entry.start
  if (ms < 0) throw new Error('entryDuration: end precedes start')
  return ms
}

/** A completed entry is valid when its end is at or after its start. */
export function isValidEntry(entry: TimeEntry): boolean {
  return entry.end === null || entry.end >= entry.start
}
