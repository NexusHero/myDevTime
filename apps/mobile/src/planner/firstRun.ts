/**
 * Sevi first run (ADR-0072 D3, REQ-074, issue #341): a truly empty planner is
 * Sevi's stage — two/three answers become the **first ghost week**, built here as
 * pure, deterministic layout (ADR-0005: no LLM anywhere near this; the same
 * answers always yield the same week). The caller previews the blocks as ghosts
 * and, on the one confirming tap, applies each day through the plan-apply seam
 * (`add-blocks`, provenance `planner-firstrun`) — nothing is booked before the
 * tap, and no demo/mock data exists at any point (honesty rule).
 */

export interface FirstRunAnswers {
  /** "Wann fängst du an?" — day start as an absolute minute of day (e.g. 540 = 09:00). */
  readonly startMin: number
  /** "Woran arbeitest du heute?" — the focus topic that labels the ghost blocks. */
  readonly topic: string
  /** "Wann ist Feierabend?" — day end as an absolute minute of day (e.g. 1050 = 17:30). */
  readonly endMin: number
}

/** One proposed ghost block, in the plan-apply seam's `add-blocks` shape. */
export interface FirstRunBlock {
  readonly startMin: number
  readonly lenMin: number
  readonly kind: 'focus' | 'break'
  readonly label: string
}

const FOCUS_MIN = 120
const BREAK_MIN = 30
/** A remainder below this is dropped rather than planned as a token sliver. */
const MIN_TAIL_MIN = 30

/**
 * One day's ghost blocks from the answers: focus runs of up to two hours with a
 * 30-minute break between them, from the answered start to the answered end.
 * A final remainder shorter than 30 minutes is dropped — the plan tells the
 * truth instead of padding. Returns `[]` when the answers leave no room.
 * Throws on out-of-range minutes so a bad answer fails loudly.
 */
export function firstRunDayBlocks(answers: FirstRunAnswers): readonly FirstRunBlock[] {
  const { startMin, endMin } = answers
  const topic = answers.topic.trim()
  if (!Number.isInteger(startMin) || startMin < 0 || startMin >= 1440) {
    throw new Error('startMin must be a minute of day')
  }
  if (!Number.isInteger(endMin) || endMin <= startMin || endMin > 1440) {
    throw new Error('endMin must be a minute of day after startMin')
  }
  const label = topic === '' ? 'Fokus' : topic
  const blocks: FirstRunBlock[] = []
  let cursor = startMin
  while (endMin - cursor >= MIN_TAIL_MIN) {
    const focusLen = Math.min(FOCUS_MIN, endMin - cursor)
    blocks.push({ startMin: cursor, lenMin: focusLen, kind: 'focus', label })
    cursor += focusLen
    // A break is only worth its 30 minutes when at least an hour of focus follows;
    // a shorter tail runs through as one final focus block.
    if (endMin - cursor >= BREAK_MIN + 60) {
      blocks.push({ startMin: cursor, lenMin: BREAK_MIN, kind: 'break', label: 'Pause' })
      cursor += BREAK_MIN
    } else if (endMin - cursor < MIN_TAIL_MIN) {
      break
    }
  }
  return blocks
}

/** One planned day of the first ghost week: its `YYYY-MM-DD` date + its blocks. */
export interface FirstRunDay {
  readonly date: string
  readonly blocks: readonly FirstRunBlock[]
}

/**
 * The full first ghost week: the same deterministic day layout on every given
 * date. The dates come from the caller (pure function, no clock): the planner
 * passes the visible week's not-yet-past weekdays — the past is never planned.
 * Dates with no room (answers too tight) are omitted entirely.
 */
export function firstRunGhostWeek(
  answers: FirstRunAnswers,
  dates: readonly string[],
): readonly FirstRunDay[] {
  const blocks = firstRunDayBlocks(answers)
  if (blocks.length === 0) return []
  return dates.map(date => ({ date, blocks }))
}

/**
 * The dates the first ghost week may plan: the visible week's Mon–Fri days that
 * are not in the past (`todayKey` compares lexicographically on `YYYY-MM-DD`).
 * `weekDates` are the week's day keys in order, Monday first. Pure — the caller
 * supplies today's key, so the choice is testable without a clock.
 */
export function firstRunPlannableDates(
  weekDates: readonly string[],
  todayKey: string,
): readonly string[] {
  return weekDates.slice(0, 5).filter(date => date >= todayKey)
}
