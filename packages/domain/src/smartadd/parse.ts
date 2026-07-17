import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'

/**
 * Smart-Add typed-entry parser (REQ-047, ADR-0065) — the deterministic **Stage 1** of
 * the "one plus, one field" quick-add (design v13, K6). It reads a natural-language
 * phrase and produces a **typed draft** the user confirms as a correctable chip: which
 * kind of entry (task / meeting / absence / travel / private), the times, a project or
 * ticket hint, the day. Pure and reproducible (de/en), no I/O, ADR-0005.
 *
 * It never persists and never guesses silently: when the rules are too weak to be sure
 * (`needsAi`), the caller may hand the phrase to the grounded LLM **Stage 2** fallback
 * (ADR-0029), which returns another draft the core still validates. Deterministic UI
 * (a confident rule parse) wears no AI signature; only the Stage-2 result does.
 */

export type SmartEntryKind = 'task' | 'meeting' | 'absence' | 'travel' | 'private'

export interface SmartEntryDraft {
  readonly kind: SmartEntryKind
  /** The cleaned title (input minus the tokens the parser consumed). */
  readonly title: string
  /** A project/ticket hint to resolve against the catalog (catalog name, `@sigil`), or null. */
  readonly projectHint: string | null
  /** An issue-tracker key if present (`PROJ-142`), else null. */
  readonly ticketKey: string | null
  /** Local day as an offset from today: 0 today, −1 yesterday, +1 tomorrow, +2… a named weekday. */
  readonly dayOffset: number
  /** Start minute-of-day when a clock time/range was given, else null. */
  readonly startMin: number | null
  /** End minute-of-day when a `H:MM–H:MM` range was given, else null. */
  readonly endMin: number | null
  /** Duration in ms when a bare duration (not a range) was given, else null. */
  readonly durationMs: number | null
  readonly billable: boolean
  /** Rule confidence 0..1. */
  readonly confidence: number
  /** True when the rules were too weak to trust the type — the Stage-2 AI fallback (ADR-0029). */
  readonly needsAi: boolean
}

export interface SmartParseOptions {
  /** Project/ticket names from the workspace catalog, so a bare name resolves to a hint. */
  readonly knownProjects?: readonly string[]
}

const CLOCK_RANGE_RE = /\b(\d{1,2}):(\d{2})\s*(?:[-–—]|bis|to|till|until)\s*(\d{1,2}):(\d{2})\b/i
const TIME_OF_DAY_RE = /(?:\b(?:at|um|ab|von|gegen)\s+|@\s*)(\d{1,2}):(\d{2})\b/i
const HOURS_RE = /(\d+(?:[.,]\d+)?)\s*(?:stunden|stunde|hours|hour|hrs|hr|std|h)\b/gi
const MINUTES_RE = /(\d+)\s*(?:minuten|minute|minutes|mins|min|m)\b/gi
const TICKET_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/

/** Weekday names → their index (Mon=0). Used to resolve "on Friday". */
const WEEKDAYS: readonly (readonly string[])[] = [
  ['monday', 'montag', 'mon', 'mo'],
  ['tuesday', 'dienstag', 'tue', 'di'],
  ['wednesday', 'mittwoch', 'wed', 'mi'],
  ['thursday', 'donnerstag', 'thu', 'do'],
  ['friday', 'freitag', 'fri', 'fr'],
  ['saturday', 'samstag', 'sat', 'sa'],
  ['sunday', 'sonntag', 'sun', 'so'],
]

const TRAVEL_RE = /\b(fahrt|drive|driving|bahn|zug|train|reise|travel|trip|commute|pendeln)\b/i
const ABSENCE_RE =
  /\b(urlaub|vacation|holiday|krank|sick|krankheit|frei|day ?off|abwesenheit|absence|gleitzeit|zeitausgleich)\b/i
const PRIVATE_RE = /\b(privat|private|personal|arzt|doctor|gym|sport|lunch|mittag|errand|termin privat)\b/i
const MEETING_RE =
  /\b(meeting|call|termin|sync|standup|stand-up|1:1|jour ?fixe|review|besprechung|kickoff|kick-off|retro|planning|workshop|interview)\b/i

/** Escape a string for safe embedding in a `RegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Clamp a `H:MM` to a valid minute-of-day, or null if out of range. */
function clockToMin(h: number, m: number): number | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/**
 * Parse a phrase into a typed Smart-Add draft. Always returns a draft (never null): a
 * weak parse comes back with `needsAi: true` and the best-effort type, so the caller
 * can offer the correctable chip and, on demand, the Stage-2 AI fallback.
 */
export function parseEntry(text: string, opts: SmartParseOptions = {}): SmartEntryDraft {
  let rest = ` ${text} `

  // 1. Times. A range wins (meeting-shaped); else a single time-of-day; else a duration.
  let startMin: number | null = null
  let endMin: number | null = null
  let durationMs: number | null = null
  const range = CLOCK_RANGE_RE.exec(rest)
  if (range) {
    startMin = clockToMin(Number(range[1]), Number(range[2]))
    endMin = clockToMin(Number(range[3]), Number(range[4]))
    rest = rest.replace(range[0], ' ')
  } else {
    const tod = TIME_OF_DAY_RE.exec(rest)
    if (tod) {
      startMin = clockToMin(Number(tod[1]), Number(tod[2]))
      rest = rest.replace(tod[0], ' ')
    }
    let ms = 0
    rest = rest.replace(HOURS_RE, (_m, h: string) => {
      ms += Number(h.replace(',', '.')) * HOUR_MS
      return ' '
    })
    rest = rest.replace(MINUTES_RE, (_m, min: string) => {
      ms += Number(min) * MINUTE_MS
      return ' '
    })
    if (ms > 0) durationMs = ms
  }

  // 2. Day: relative words, then a named weekday (nearest upcoming).
  let dayOffset = 0
  const dayExplicit = /\b(today|heute|yesterday|gestern|tomorrow|morgen)\b/i.test(text)
  rest = rest.replace(/\b(yesterday|gestern)\b/i, () => {
    dayOffset = -1
    return ' '
  })
  rest = rest.replace(/\b(tomorrow|morgen)\b/i, () => {
    dayOffset = 1
    return ' '
  })
  rest = rest.replace(/\b(today|heute)\b/i, () => ' ')

  // 3. Ticket key + project hint (most explicit first).
  let ticketKey: string | null = null
  let projectHint: string | null = null
  const ticket = TICKET_RE.exec(rest)
  if (ticket?.[1] !== undefined) {
    ticketKey = ticket[1]
    projectHint = ticket[1]
    rest = rest.replace(ticket[0], ' ')
  }
  const sigil = /[@#]([\p{L}\d][\p{L}\d-]*)/u.exec(rest)
  if (projectHint === null && sigil?.[1] !== undefined) {
    projectHint = sigil[1]
    rest = rest.replace(sigil[0], ' ')
  }
  if (projectHint === null) {
    for (const name of opts.knownProjects ?? []) {
      if (name.length === 0) continue
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'iu')
      const hit = re.exec(rest)
      if (hit) {
        projectHint = name
        rest = rest.replace(hit[0], ' ')
        break
      }
    }
  }

  // 4. Billable: private/absence are never billable; otherwise on unless said otherwise.
  let billableSaid: boolean | null = null
  rest = rest.replace(
    /\b(?:non-?billable|unbillable|nicht abrechenbar|nicht berechenbar)\b/i,
    () => {
      billableSaid = false
      return ' '
    },
  )

  // 5. Type detection — precedence: absence, travel, private, meeting, else task.
  let kind: SmartEntryKind
  let typed = true
  if (ABSENCE_RE.test(text)) kind = 'absence'
  else if (TRAVEL_RE.test(text)) kind = 'travel'
  else if (PRIVATE_RE.test(text)) kind = 'private'
  else if (MEETING_RE.test(text) || (startMin !== null && endMin !== null)) kind = 'meeting'
  else if (ticketKey !== null || durationMs !== null || projectHint !== null) kind = 'task'
  else {
    kind = 'task'
    typed = false // nothing distinctive matched → let the AI fallback decide the type
  }

  // Resolve a named weekday only when no relative day matched (keeps "today" authoritative).
  if (dayOffset === 0 && !dayExplicit) {
    for (const [i, names] of WEEKDAYS.entries()) {
      if (names.some(n => new RegExp(`\\b${n}\\b`, 'i').test(rest))) {
        // Offset to the next occurrence of weekday i is encoded as +100+i so the caller
        // can resolve it against "today"; keeps the return simple + deterministic.
        dayOffset = 100 + i
        for (const n of names) rest = rest.replace(new RegExp(`\\b${n}\\b`, 'i'), ' ')
        break
      }
    }
  }

  const title = rest.replace(/\s+/g, ' ').trim()

  const billable = kind === 'absence' || kind === 'private' ? false : (billableSaid ?? true)

  let confidence = typed ? 0.5 : 0.2
  if (ticketKey !== null || projectHint !== null) confidence += 0.2
  if (startMin !== null || durationMs !== null) confidence += 0.2
  if (dayExplicit || dayOffset >= 100) confidence += 0.1
  confidence = Math.min(1, confidence)

  return {
    kind,
    title,
    projectHint,
    ticketKey,
    dayOffset,
    startMin,
    endMin,
    durationMs,
    billable,
    confidence,
    // Weak parse: no type signal AND nothing concrete to anchor on → offer AI (ADR-0029).
    needsAi: !typed && ticketKey === null && startMin === null && durationMs === null,
  }
}
