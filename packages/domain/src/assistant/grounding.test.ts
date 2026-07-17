import { describe, expect, it } from 'vitest'
import { isOffData, rankFacts, selectGroundingFacts, tokenize } from './grounding.js'

const facts = [
  'You tracked 2h on the Finanzo invoice project yesterday',
  'Your overtime balance this week is minus 3 hours',
  'The myDevTime budget is 80 percent consumed',
  'Lunch break was 45 minutes',
]

describe('tokenize', () => {
  it('LowercasesAndDropsShortTokensAndStopwords', () => {
    expect(tokenize('The Finanzo Invoice, 2h!')).toEqual(['finanzo', 'invoice'])
  })
})

describe('rankFacts', () => {
  it('RanksTheMostRelevantFactFirst', () => {
    const ranked = rankFacts('how much overtime this week?', facts)
    expect(ranked[0]?.fact).toContain('overtime balance')
    expect(ranked[0]?.score).toBeGreaterThan(0)
  })

  it('AFactSharingNoQueryToken_ScoresZero', () => {
    const ranked = rankFacts('overtime', facts)
    expect(ranked.find(r => r.fact.includes('Lunch'))?.score).toBe(0)
  })

  it('RareSharedWordsOutweighCommonOnes', () => {
    // "finanzo" is rare (1 fact), "the" is common — a finanzo question ranks the finanzo fact top.
    const ranked = rankFacts('what about finanzo the project', facts)
    expect(ranked[0]?.fact).toContain('Finanzo')
  })

  it('StableOrderOnTies', () => {
    const ranked = rankFacts('zzz nothing matches', facts)
    expect(ranked.map(r => r.fact)).toEqual(facts) // all score 0 → original order preserved
  })
})

describe('selectGroundingFacts', () => {
  it('KeepsOnlyRelevantFacts_cappedAtMaxFacts', () => {
    const selected = selectGroundingFacts('overtime balance this week', facts, { maxFacts: 2 })
    expect(selected.length).toBeLessThanOrEqual(2)
    expect(selected[0]).toContain('overtime')
  })

  it('IrrelevantQuestion_SelectsNothing', () => {
    expect(selectGroundingFacts('what is the weather in Tokyo', facts)).toEqual([])
  })

  it('NoFacts_SelectsNothing', () => {
    expect(selectGroundingFacts('anything', [])).toEqual([])
  })
})

describe('isOffData', () => {
  it('TrueWhenNothingRelevant', () => {
    expect(isOffData('weather in Tokyo', facts)).toBe(true)
    expect(isOffData('anything', [])).toBe(true)
  })

  it('FalseWhenAFactIsRelevant', () => {
    expect(isOffData('overtime balance', facts)).toBe(false)
  })
})
