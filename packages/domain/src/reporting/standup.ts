import { HOUR_MS } from '../tracking/time.js'

/**
 * Standup / summary core (REQ-014, ADR-0005) — the deterministic grounding for the AI standup
 * report. It turns grouped tracked time into a structured report with **fixed numeric slots**; the
 * grounded LLM writes a narrative *around* these numbers but may never change them (slot integrity).
 * `renderStandupPlain` is the plain-template degradation the app falls back to when the LLM is down —
 * the report is always readable without AI. Every figure is the caller's own tracked data (ADR-0005):
 * this never invents a number, only arranges it, and `slotsPreserved` verifies an AI draft kept them.
 */

/** One line of the report — a label and its duration; the duration is a protected slot. */
export interface StandupLine {
  readonly label: string
  readonly ms: number
}

export interface StandupInput {
  /** ISO date the standup is for, `YYYY-MM-DD`. */
  readonly date: string
  /** What was tracked the previous working day, per project/task label. */
  readonly yesterday: readonly StandupLine[]
  /** What is planned/tracked so far today. */
  readonly today: readonly StandupLine[]
  /** Free-text blockers the user typed (never invented). */
  readonly blockers?: readonly string[]
}

export interface StandupReport {
  readonly date: string
  readonly yesterday: readonly StandupLine[]
  readonly today: readonly StandupLine[]
  readonly blockers: readonly string[]
  readonly totalYesterdayMs: number
  readonly totalTodayMs: number
}

function sum(lines: readonly StandupLine[]): number {
  return lines.reduce((acc, l) => acc + Math.max(0, l.ms), 0)
}

/** Drop empty/zero lines and sort by duration desc (stable by label) — deterministic ordering. */
function normalize(lines: readonly StandupLine[]): StandupLine[] {
  return lines
    .filter(l => l.ms > 0 && l.label.trim().length > 0)
    .map(l => ({ label: l.label.trim(), ms: l.ms }))
    .sort((a, b) =>
      b.ms === a.ms ? (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) : b.ms - a.ms,
    )
}

/** Build the structured standup report from grouped durations — pure, no clock, no AI. */
export function buildStandup(input: StandupInput): StandupReport {
  const yesterday = normalize(input.yesterday)
  const today = normalize(input.today)
  return {
    date: input.date,
    yesterday,
    today,
    blockers: (input.blockers ?? []).map(b => b.trim()).filter(b => b.length > 0),
    totalYesterdayMs: sum(yesterday),
    totalTodayMs: sum(today),
  }
}

/** Format ms as `Hh Mm` / `Mm` — the exact string that appears in a slot. */
export function formatHm(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? (m > 0 ? `${String(h)}h ${String(m)}m` : `${String(h)}h`) : `${String(m)}m`
}

/**
 * The protected numeric slots the AI narrative must preserve verbatim: every line's duration plus
 * the two totals. If any slot string is missing from an AI draft, the draft altered a number and is
 * rejected (slot integrity, REQ-014).
 */
export function standupSlots(report: StandupReport): string[] {
  const slots = new Set<string>()
  for (const l of [...report.yesterday, ...report.today]) slots.add(formatHm(l.ms))
  slots.add(formatHm(report.totalYesterdayMs))
  slots.add(formatHm(report.totalTodayMs))
  return [...slots]
}

/** Whether an AI-written draft preserved every numeric slot (none dropped or altered). */
export function slotsPreserved(draft: string, report: StandupReport): boolean {
  return standupSlots(report).every(slot => draft.includes(slot))
}

/**
 * The plain-template rendering — the always-available, AI-free standup. This is both the degradation
 * fallback (LLM down) and the ground truth a narrative is checked against. Hours use `formatHm`, so
 * its numbers are exactly the protected slots.
 */
export function renderStandupPlain(report: StandupReport): string {
  const line = (l: StandupLine): string => `- ${l.label} (${formatHm(l.ms)})`
  const parts: string[] = [`Standup ${report.date}`]
  parts.push(`Yesterday (${formatHm(report.totalYesterdayMs)}):`)
  parts.push(...(report.yesterday.length ? report.yesterday.map(line) : ['- (nothing tracked)']))
  parts.push(`Today (${formatHm(report.totalTodayMs)}):`)
  parts.push(...(report.today.length ? report.today.map(line) : ['- (nothing planned)']))
  if (report.blockers.length) {
    parts.push('Blockers:')
    parts.push(...report.blockers.map(b => `- ${b}`))
  }
  return parts.join('\n')
}

/** Convenience: hours (2dp) for a duration, for callers that need a number not a string. */
export function msToHours(ms: number): number {
  return Math.round((ms / HOUR_MS) * 100) / 100
}
