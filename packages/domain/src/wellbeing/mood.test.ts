import { describe, expect, it } from 'vitest'
import { moodScoreOf, MOOD_WORDS } from './mood.js'
import { LOW_MOOD_MAXIMUM } from './dayReview.js'

/**
 * The punch-out mood → day-review score mapping (ADR-0071 P3, REQ-068). Three words, three
 * fixed scores on the `moodScore` 1..5 scale: only 'good' clears the `low-mood` line — 'tense'
 * and 'stressed' both sit at or below `LOW_MOOD_MAXIMUM`, so a consented low mood really feeds
 * the existing `low-mood` signal path.
 */
describe('moodScoreOf', () => {
  it('MapsEachMoodWordToItsFixedScore', () => {
    expect(moodScoreOf('good')).toBe(4)
    expect(moodScoreOf('tense')).toBe(2)
    expect(moodScoreOf('stressed')).toBe(1)
  })

  it('OnlyGood_ClearsTheLowMoodLine', () => {
    expect(moodScoreOf('good')).toBeGreaterThan(LOW_MOOD_MAXIMUM)
    expect(moodScoreOf('tense')).toBeLessThanOrEqual(LOW_MOOD_MAXIMUM)
    expect(moodScoreOf('stressed')).toBeLessThanOrEqual(LOW_MOOD_MAXIMUM)
  })

  it('MoodWords_ListsTheClosedVocabulary', () => {
    expect(MOOD_WORDS).toEqual(['good', 'tense', 'stressed'])
  })
})
