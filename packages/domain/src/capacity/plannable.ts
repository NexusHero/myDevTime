import { MINUTE_MS, type DurationMs } from '../tracking/time.js'

/**
 * Capacity honesty (REQ-055, design v14 §F Stufe 2) — one person, one timeline: work
 * and life share the same planner, so the week you can actually work is the contracted
 * target **minus your own life and protected commitments**. A week with a 40h target and
 * 16h of family/protected blocks is a 24h week ("KW32 nur 24h"), and every downstream
 * consumer — Fill-week, the overbooking warning, the KI2 quote calculator — must plan
 * against *this* number, never the raw target.
 *
 * Pure and deterministic (ADR-0005): a `life` entry (family, personal) or a life block
 * flagged `protected` (🛡, D14) both consume plannable time. Overlapping commitments are
 * merged so double-booked life time is never subtracted twice. Nothing here is a health
 * judgement — it is only your own calendar, honestly summed.
 */

/** What consumes plannable capacity: a `life` entry, or a life block shielded with 🛡. */
export type CommitmentKind = 'life' | 'protected'

export interface Commitment {
  readonly kind: CommitmentKind
  /** Start, minute-of-day in [0, 1440]. */
  readonly startMin: number
  /** End, minute-of-day in (startMin, 1440]. Zero-length/inverted intervals are ignored. */
  readonly endMin: number
}

export interface CapacityDay {
  /** Contracted work target for the day, ms (0 on a non-working day). */
  readonly targetMs: DurationMs
  /** The person's own life/protected commitments on this day. */
  readonly commitments: readonly Commitment[]
}

export interface DayCapacity {
  readonly targetMs: DurationMs
  /** Life/protected time on the day, overlaps merged (ms). */
  readonly committedMs: DurationMs
  /** What truly remains plannable for work: `max(0, target − committed)`. */
  readonly plannableMs: DurationMs
}

export interface WeekCapacity {
  readonly days: readonly DayCapacity[]
  readonly targetMs: DurationMs
  readonly committedMs: DurationMs
  readonly plannableMs: DurationMs
}

interface Interval {
  start: number
  end: number
}

/** Merge a day's commitments into non-overlapping intervals, in start order. */
function mergeCommitments(commitments: readonly Commitment[]): Interval[] {
  const valid = commitments
    .filter(c => c.endMin > c.startMin)
    .map(c => ({ start: c.startMin, end: c.endMin }))
    .sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const iv of valid) {
    const last = merged.at(-1)
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end)
    } else {
      merged.push({ start: iv.start, end: iv.end })
    }
  }
  return merged
}

/**
 * Total committed minutes on a day, overlaps merged so double-booked life time is not
 * counted twice. Zero-length and inverted intervals are dropped.
 */
export function committedMinutes(commitments: readonly Commitment[]): number {
  return mergeCommitments(commitments).reduce((sum, iv) => sum + (iv.end - iv.start), 0)
}

function assertInRange(commitments: readonly Commitment[]): void {
  for (const c of commitments) {
    if (c.startMin < 0 || c.endMin > 1440) {
      throw new Error('commitment must lie within the day (0..1440 minutes)')
    }
  }
}

/** True plannable capacity for one day: contracted target minus merged life/protected time. */
export function dayCapacity(day: CapacityDay): DayCapacity {
  if (day.targetMs < 0) throw new Error('targetMs must be non-negative')
  assertInRange(day.commitments)
  const committedMs = committedMinutes(day.commitments) * MINUTE_MS
  const plannableMs = Math.max(0, day.targetMs - committedMs)
  return { targetMs: day.targetMs, committedMs, plannableMs }
}

/** Aggregate a week's honest capacity from its days. */
export function weekCapacity(days: readonly CapacityDay[]): WeekCapacity {
  const resolved = days.map(dayCapacity)
  return {
    days: resolved,
    targetMs: resolved.reduce((s, d) => s + d.targetMs, 0),
    committedMs: resolved.reduce((s, d) => s + d.committedMs, 0),
    plannableMs: resolved.reduce((s, d) => s + d.plannableMs, 0),
  }
}

/**
 * How far a planned amount of work overruns the *true* plannable capacity (0 when it
 * fits). This is the honest overbooking signal: it counts life/protected time against
 * you, so a "full" week of work on top of a heavy-life week reads as overbooked.
 */
export function overbookedMs(
  capacity: { readonly plannableMs: DurationMs },
  plannedWorkMs: DurationMs,
): DurationMs {
  return Math.max(0, plannedWorkMs - capacity.plannableMs)
}
