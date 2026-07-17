/**
 * Meeting-notes core (REQ-054, ADR-0065 · design v13 KI4) — the deterministic grounding
 * for the AI meeting follow-up. It turns free-form meeting notes into a clean, ordered set
 * of **fact lines** (action-like ones first) that the grounded LLM phrases into follow-up
 * actions. Pure and reproducible (ADR-0005): no I/O, no model. The notes are the user's own
 * typed text — real, consent-first data — so this never invents content, only shapes it.
 * ASR auto-capture (ADR-0009) is a future adapter that would feed the same function.
 */

/** Cues that mark a note line as an action/decision worth surfacing first. */
const ACTION_RE =
  /\b(todo|to-do|action|follow[- ]?up|next step|decide|decision|owner|assign|due|deadline|will|should|must|need to|schedule|send|review|ship|fix|prepare)\b/i
/** A leading list marker (-, •, *, digit., digit)). */
const BULLET_RE = /^\s*(?:[-•*]|\d+[.)])\s+/
/** An @mention, often an assignee. */
const MENTION_RE = /(^|\s)@[\p{L}\d._-]+/u

/** Whether a line reads like an action item or a decision. */
export function looksLikeAction(line: string): boolean {
  return BULLET_RE.test(line) || ACTION_RE.test(line) || MENTION_RE.test(line)
}

export interface MeetingNotesOptions {
  /** Maximum fact lines to return (default 12). */
  readonly max?: number
}

/**
 * Extract grounded fact lines from meeting notes: split on line breaks, trim, drop empties
 * and leading list markers, de-duplicate case-insensitively, and order action-like lines
 * first (stable within each group). Returns at most `max` lines; empty when the notes carry
 * nothing usable, so the caller refuses rather than inventing follow-ups.
 */
export function meetingNotesFacts(notes: string, opts: MeetingNotesOptions = {}): string[] {
  const max = opts.max ?? 12
  const seen = new Set<string>()
  const actions: string[] = []
  const rest: string[] = []

  for (const raw of notes.split(/\r?\n/)) {
    const action = looksLikeAction(raw)
    const cleaned = raw.replace(BULLET_RE, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length === 0) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    ;(action ? actions : rest).push(cleaned)
  }

  return [...actions, ...rest].slice(0, max)
}
