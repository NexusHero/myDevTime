import { describe, expect, it } from 'vitest'
import { looksLikeAction, meetingNotesFacts } from './notes.js'

/**
 * Acceptance for the meeting-notes core (REQ-054, design v13 KI4). It grounds the AI
 * follow-up in the user's own typed notes — action-like lines first, deduped, capped.
 */
describe('looksLikeAction', () => {
  it('SpotsBulletsActionCuesAndMentions', () => {
    expect(looksLikeAction('- ship the export by Friday')).toBe(true)
    expect(looksLikeAction('Decision: use Postgres')).toBe(true)
    expect(looksLikeAction('@alex to send the deck')).toBe(true)
  })
  it('IgnoresPlainProse', () => {
    expect(looksLikeAction('We talked about the weather.')).toBe(false)
  })
})

describe('meetingNotesFacts', () => {
  it('OrdersActionLinesFirstAndStripsBullets', () => {
    const facts = meetingNotesFacts(
      [
        'Nice chat about Q3.',
        '- Fix the flaky test',
        'Background context here.',
        'TODO: send invoice',
      ].join('\n'),
    )
    expect(facts[0]).toBe('Fix the flaky test')
    expect(facts[1]).toBe('TODO: send invoice')
    expect(facts).toContain('Nice chat about Q3.')
  })

  it('DedupesCaseInsensitivelyAndDropsEmpties', () => {
    const facts = meetingNotesFacts('- Send deck\n\n- send deck\n   \n- Send Deck')
    expect(facts).toEqual(['Send deck'])
  })

  it('CapsToTheMax', () => {
    const many = Array.from({ length: 20 }, (_, i) => `- action ${String(i)}`).join('\n')
    expect(meetingNotesFacts(many, { max: 5 })).toHaveLength(5)
  })

  it('IsEmptyForBlankNotes', () => {
    expect(meetingNotesFacts('   \n\n  ')).toEqual([])
  })
})
