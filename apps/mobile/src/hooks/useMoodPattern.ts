import { useEffect, useState } from 'react'
import { moodEntryOf, moodPatterns, type MoodPatterns } from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { getMoodHistory } from '../api/mood.js'
import { pick } from '../i18n/strings.js'

/**
 * Sevi's mood-pattern awareness, client side (REQ-068, ADR-0071): the consented mood history
 * (`GET /api/wellbeing/mood` — empty without the stored opt-in, so consent-off users get the
 * honest empty pattern for free) runs through the pure domain `moodPatterns` core. Every
 * judgement is the core's (ADR-0005): a weekday flags only on enough of the person's own
 * samples with a low median — never from one bad day. With no API configured, or a failed
 * read, the hook resolves to the "not enough data" empty pattern rather than inventing one.
 */

/** The honest empty pattern: nothing flagged, not enough data to judge. */
const NO_PATTERN: MoodPatterns = { lowWeekdays: [], enoughData: false }

export interface MoodPatternResource {
  readonly pattern: MoodPatterns
  readonly loading: boolean
}

export function useMoodPattern(): MoodPatternResource {
  const base = apiBaseUrl
  const [pattern, setPattern] = useState<MoodPatterns>(NO_PATTERN)
  const [loading, setLoading] = useState(base !== null)

  useEffect(() => {
    if (base === null) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    getMoodHistory(base)
      // `moodEntryOf` derives the weekday with the server's exact convention (UTC, Sunday 0).
      .then(history => {
        if (alive) setPattern(moodPatterns(history.map(d => moodEntryOf(d.day, d.mood))))
      })
      .catch(() => {
        if (alive) setPattern(NO_PATTERN)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base])

  return { pattern, loading }
}

// The weekday adverbs for the ONE calm pattern line, indexed by the UTC Sunday-0 weekday.
const WEEKDAYS_EN = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
] as const
const WEEKDAYS_DE = [
  'Sonntags',
  'Montags',
  'Dienstags',
  'Mittwochs',
  'Donnerstags',
  'Freitags',
  'Samstags',
] as const

/**
 * The one calm pattern line for the Balance area ("Tuesdays often tense" / "Dienstags oft
 * angespannt"), from the FIRST flagged weekday (the core orders them deterministically), or
 * `null` when nothing is flagged — the note simply stays away rather than filling space.
 * An observation about days, never about the person (the Balance-Feature ethic).
 */
export function moodPatternNote(pattern: MoodPatterns): string | null {
  const low = pattern.lowWeekdays[0]
  if (low === undefined) return null
  const en = WEEKDAYS_EN[low.weekday]
  const de = WEEKDAYS_DE[low.weekday]
  // An out-of-range weekday cannot come from the core; stay silent rather than crash a screen.
  if (en === undefined || de === undefined) return null
  return pick(`${en} often tense`, `${de} oft angespannt`)
}
