/**
 * Punch-out mood vocabulary (ADR-0071 P3, REQ-068). The MoodCheck offers exactly three words —
 * Good / Tense / Stressed — and, once the user has consented to mood memory, the stored word
 * feeds the day review through this fixed mapping onto the existing 1..5 `moodScore` scale.
 * 'tense' (2) and 'stressed' (1) sit at or below `LOW_MOOD_MAXIMUM`, so both fire the
 * `low-mood` signal path that has existed (unfed) since REQ-065; 'good' (4) clears it. A word,
 * never a diagnosis — the mapping is data, not judgement (ADR-0066 ethic). Pure (ADR-0005).
 */

/** The closed punch-out mood vocabulary. */
export type Mood = 'good' | 'tense' | 'stressed'

/** Every mood word, in display order — the contract wire schemas validate against. */
export const MOOD_WORDS: readonly Mood[] = ['good', 'tense', 'stressed']

/**
 * The fixed mood → `moodScore` mapping (see module doc): good → 4, tense → 2, stressed → 1.
 * Feeds `reviewDay`'s optional `moodScore`, where ≤ `LOW_MOOD_MAXIMUM` fires `low-mood`.
 */
export function moodScoreOf(mood: Mood): 4 | 2 | 1 {
  switch (mood) {
    case 'good':
      return 4
    case 'tense':
      return 2
    case 'stressed':
      return 1
  }
}
