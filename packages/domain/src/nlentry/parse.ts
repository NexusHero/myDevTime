import { HOUR_MS, MINUTE_MS, type DurationMs } from '../tracking/time.js'

/**
 * The deterministic natural-language pre-parser (REQ-013, ADR-0005). It turns a
 * phrase like "2h on Finanzo API review yesterday" into a **draft** — duration,
 * which day, a project hint, a note, billable — that the user confirms; it never
 * persists. Pure and reproducible (de/en). What it cannot parse (no duration) is
 * where the LLM fallback takes over (ADR-0029), and even then the result is a
 * draft the core validates, never a written entry.
 */

export interface TimeEntryDraft {
  readonly durationMs: DurationMs
  /** The local day as an offset from today: 0 = today, −1 = yesterday. */
  readonly dayOffset: number
  /** A raw project/task hint (e.g. `Finanzo`) to resolve against the catalog, or null. */
  readonly projectHint: string | null
  readonly note: string | null
  readonly billable: boolean
  /** Heuristic 0..1: higher when the project and the day are explicit. */
  readonly confidence: number
}

const CLOCK_RE = /\b(\d{1,2}):(\d{2})\b/g
/**
 * A clock-shaped token reads as a **time of day**, not a duration, when it is
 * preceded by an at/um/ab/von/gegen cue or an `@`. These must not be summed as a
 * duration (M5): "call at 9:30" is not a 9 h 30 m entry.
 */
const TIME_OF_DAY_RE = /(?:\b(?:at|um|ab|von|gegen)\s+|@\s*)\d{1,2}:\d{2}\b/gi
/** A `H:MM–H:MM` window (a meeting range) is a time span, not a duration to sum (M5). */
const CLOCK_RANGE_RE = /\b\d{1,2}:\d{2}\s*(?:[-–—]|bis|to|till|until)\s*\d{1,2}:\d{2}\b/gi
// Bounded digit runs so the optional-decimal group can't backtrack polynomially on a
// long run of digits with no trailing unit (CodeQL ReDoS-hardening; durations are small).
const HOURS_RE = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:stunden|stunde|hours|hour|hrs|hr|std|h)\b/gi
const MINUTES_RE = /(\d{1,4})\s*(?:minuten|minute|minutes|mins|min|m)\b/gi
/** An issue-tracker key like `PROJ-142`, `AUTH-7` (Jira/Linear/GitHub/Azure style). */
const TICKET_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/

export interface ParseOptions {
  /**
   * Project/ticket names the caller knows from the workspace catalog. A phrase
   * token matching one (case-insensitively) becomes the project hint in the
   * catalog's canonical casing — this is how a bare name like "logo" resolves
   * without a keyword. The parser stays pure; the caller supplies the vocabulary.
   */
  readonly knownProjects?: readonly string[]
}

/** Escape a string for safe embedding in a `RegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Parse a phrase into a draft time entry, or null when no duration is present. */
export function parseTimeEntry(text: string, opts: ParseOptions = {}): TimeEntryDraft | null {
  let rest = ` ${text} `
  let durationMs = 0

  // Strip clock tokens that read as a time of day (a range, or an at/um/@ cue)
  // BEFORE the duration pass, so they contribute no duration (M5). A bare `2:30`
  // that survives is still a duration.
  rest = rest.replace(CLOCK_RANGE_RE, ' ').replace(TIME_OF_DAY_RE, ' ')

  rest = rest.replace(CLOCK_RE, (_m, h: string, min: string) => {
    durationMs += Number(h) * HOUR_MS + Number(min) * MINUTE_MS
    return ' '
  })
  rest = rest.replace(HOURS_RE, (_m, h: string) => {
    durationMs += Number(h.replace(',', '.')) * HOUR_MS
    return ' '
  })
  rest = rest.replace(MINUTES_RE, (_m, min: string) => {
    durationMs += Number(min) * MINUTE_MS
    return ' '
  })

  if (durationMs <= 0) return null

  // Day. `dayExplicit` is read from a direct test (not a callback-mutated flag) so
  // control-flow analysis keeps it a real boolean.
  const dayExplicit = /\b(today|heute|yesterday|gestern)\b/i.test(text)
  let dayOffset = 0
  rest = rest.replace(/\b(yesterday|gestern)\b/i, () => {
    dayOffset = -1
    return ' '
  })
  rest = rest.replace(/\b(today|heute)\b/i, () => ' ')

  // Billable.
  let billable = true
  rest = rest.replace(
    /\b(?:non-?billable|unbillable|nicht abrechenbar|nicht berechenbar)\b/i,
    () => {
      billable = false
      return ' '
    },
  )

  // Project hint, most-explicit first: a @sigil / #tag, then an issue-tracker key
  // (PROJ-142), then a known catalog name ("logo"), then a keyword + word.
  let projectHint: string | null = null
  const sigil = /[@#]([\p{L}\d][\p{L}\d-]*)/u.exec(rest)
  const ticket = TICKET_RE.exec(rest)
  if (sigil?.[1]) {
    projectHint = sigil[1]
    rest = rest.replace(sigil[0], ' ')
  } else if (ticket?.[1]) {
    projectHint = ticket[1]
    rest = rest.replace(ticket[0], ' ')
  } else {
    for (const name of opts.knownProjects ?? []) {
      if (name.length === 0) continue
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'iu')
      const hit = re.exec(rest)
      if (hit) {
        projectHint = name // canonical catalog casing, not the phrase's casing
        rest = rest.replace(hit[0], ' ')
        break
      }
    }
    if (projectHint === null) {
      const keyword = /\b(?:on|for|für|auf)\s+([\p{L}][\p{L}\d-]*)/iu.exec(rest)
      if (keyword?.[1]) {
        projectHint = keyword[1]
        rest = rest.replace(keyword[0], ' ')
      }
    }
  }

  const note = rest.replace(/\s+/g, ' ').trim()

  let confidence = 0.4
  if (projectHint) confidence += 0.2
  if (dayExplicit) confidence += 0.2
  if (note.length > 0) confidence += 0.2

  return {
    durationMs,
    dayOffset,
    projectHint,
    note: note.length > 0 ? note : null,
    billable,
    confidence: Math.min(1, confidence),
  }
}
