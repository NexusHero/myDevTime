import { describe, expect, it } from 'vitest'
import { matchesNoteQuery, normalizeQuery, searchEntriesByNote } from './search.js'

describe('normalizeQuery', () => {
  it('NormalizeQuery_TrimsAndLowercases', () => {
    expect(normalizeQuery('  Finanzo Review  ')).toBe('finanzo review')
  })

  it('NormalizeQuery_BlankIsEmpty', () => {
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('matchesNoteQuery', () => {
  it('MatchesNoteQuery_CaseInsensitiveSubstring_Matches', () => {
    expect(matchesNoteQuery('Fixed the Finanzo invoice bug', 'finanzo')).toBe(true)
    expect(matchesNoteQuery('Fixed the Finanzo invoice bug', 'INVOICE')).toBe(true)
  })

  it('MatchesNoteQuery_NoOverlap_DoesNotMatch', () => {
    expect(matchesNoteQuery('Design review', 'deploy')).toBe(false)
  })

  it('MatchesNoteQuery_BlankQuery_MatchesEverything', () => {
    expect(matchesNoteQuery('anything', '   ')).toBe(true)
    expect(matchesNoteQuery(undefined, '')).toBe(true)
  })

  it('MatchesNoteQuery_MissingNote_DoesNotMatchNonBlank', () => {
    expect(matchesNoteQuery(undefined, 'finanzo')).toBe(false)
    expect(matchesNoteQuery(null, 'finanzo')).toBe(false)
  })

  it('MatchesNoteQuery_UntrimmedQuery_IsTrimmedBeforeMatching', () => {
    expect(matchesNoteQuery('standup notes', '  standup ')).toBe(true)
  })
})

describe('searchEntriesByNote', () => {
  const entries = [
    { note: 'Finanzo invoice fix' },
    { note: 'Design review' },
    { note: undefined },
    { note: 'finanzo follow-up call' },
  ]

  it('SearchEntriesByNote_Query_ReturnsOnlyMatchesInOrder', () => {
    expect(searchEntriesByNote(entries, 'finanzo')).toEqual([
      { note: 'Finanzo invoice fix' },
      { note: 'finanzo follow-up call' },
    ])
  })

  it('SearchEntriesByNote_BlankQuery_ReturnsAllUnfiltered', () => {
    expect(searchEntriesByNote(entries, '  ')).toEqual(entries)
  })

  it('SearchEntriesByNote_NoMatch_ReturnsEmpty', () => {
    expect(searchEntriesByNote(entries, 'zzz')).toEqual([])
  })
})
