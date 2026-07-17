import type { RecurrenceRule } from '../recurrence/recur.js'

/**
 * Photo/mail schedule import (REQ-064, design v17 §F6 KI5) — the deterministic half of "photograph
 * a school timetable, get it as ghost series to confirm". A vision model reads the photo and
 * *proposes* structured lessons (subject, weekday, time) via a narrow port; this pure core
 * validates and shapes them into recurring-**series** proposals, reusing the §F4 `RecurrenceRule`.
 * It **never books** (ADR-0005): every result is a proposal the user confirms, carrying
 * `source: 'ai-proposal'` provenance — the AI extracts and phrases, the human accepts. Invalid
 * lessons (bad weekday, non-positive length, empty title) are dropped, never guessed.
 */

/** A lesson as a vision model proposes it from the photo — untrusted until validated here. */
export interface ExtractedLesson {
  /** Subject/title, e.g. "Mathematics". */
  readonly title: string
  /** ISO weekday 1–7 (Mon–Sun). */
  readonly weekday: number
  /** Minute-of-day the lesson starts (0–1439). */
  readonly startMin: number
  /** Length in minutes (> 0). */
  readonly lenMin: number
}

/** A validated recurring-series **proposal** — never booked until the user confirms it. */
export interface SeriesProposal {
  readonly title: string
  /** The first calendar day this weekly series lands on, `YYYY-MM-DD`. */
  readonly anchorDate: string
  readonly startMin: number
  readonly lenMin: number
  /** Weekly on the lesson's weekday, no end — a school term is truncated on confirmation. */
  readonly rule: RecurrenceRule
  /** Provenance: this came from AI extraction, the user decides (ADR-0005). */
  readonly source: 'ai-proposal'
  /** Always false here — the core proposes, it never books. */
  readonly confirmed: false
}

const DAY_MS = 86_400_000

function isoWeekday(dateMs: number): number {
  const dow = new Date(dateMs).getUTCDay() // 0=Sun..6=Sat
  return dow === 0 ? 7 : dow
}

function toDateKey(dateMs: number): string {
  return new Date(dateMs).toISOString().slice(0, 10)
}

function isValid(lesson: ExtractedLesson): boolean {
  return (
    lesson.title.trim().length > 0 &&
    Number.isInteger(lesson.weekday) &&
    lesson.weekday >= 1 &&
    lesson.weekday <= 7 &&
    Number.isInteger(lesson.startMin) &&
    lesson.startMin >= 0 &&
    lesson.startMin <= 1439 &&
    Number.isInteger(lesson.lenMin) &&
    lesson.lenMin > 0 &&
    lesson.startMin + lesson.lenMin <= 1440
  )
}

/**
 * Turn extracted lessons into weekly recurring-series proposals, anchored on or after `fromDateMs`
 * (UTC midnight of the reference day the caller passes — determinism requires an explicit "today",
 * never a clock read). Each lesson's anchor is the first day on/after `fromDateMs` matching its
 * weekday. Invalid lessons are dropped; the rest keep input order. Nothing is booked.
 */
export function toSeriesProposals(
  lessons: readonly ExtractedLesson[],
  fromDateMs: number,
): SeriesProposal[] {
  const out: SeriesProposal[] = []
  for (const lesson of lessons) {
    if (!isValid(lesson)) continue
    const offset = (lesson.weekday - isoWeekday(fromDateMs) + 7) % 7
    const anchorMs = fromDateMs + offset * DAY_MS
    out.push({
      title: lesson.title.trim(),
      anchorDate: toDateKey(anchorMs),
      startMin: lesson.startMin,
      lenMin: lesson.lenMin,
      rule: { freq: 'weekly', end: { kind: 'never' } },
      source: 'ai-proposal',
      confirmed: false,
    })
  }
  return out
}
