import { describe, expect, it } from 'vitest'
import { BANNER_PRIORITY, pickBanner, type ContextBanner } from './banner.js'

/**
 * Acceptance for the contextual-banner resolver (REQ-059, design v14 §M2). The Planner shows
 * **at most one** contextual banner, and which one is fixed: Conflict > Price-of-week >
 * Yesterday-healing > Note. One `ContextBanner` with a `variant`, one deterministic picker —
 * "der Rest wartet". Pure (ADR-0005).
 */
const b = (variant: ContextBanner['variant'], message: string = variant): ContextBanner => ({
  variant,
  message,
})

describe('pickBanner', () => {
  it('ShowsAtMostOne_TheHighestPriorityPresent', () => {
    expect(pickBanner([b('note'), b('healing'), b('price'), b('conflict')])?.variant).toBe(
      'conflict',
    )
    expect(pickBanner([b('note'), b('healing'), b('price')])?.variant).toBe('price')
    expect(pickBanner([b('note'), b('healing')])?.variant).toBe('healing')
    expect(pickBanner([b('note')])?.variant).toBe('note')
  })

  it('IsNullWhenNothingIsCandidate', () => {
    expect(pickBanner([])).toBeNull()
  })

  it('IsIndependentOfInputOrder', () => {
    const forward = pickBanner([b('conflict'), b('price'), b('healing'), b('note')])
    const reversed = pickBanner([b('note'), b('healing'), b('price'), b('conflict')])
    expect(forward?.variant).toBe('conflict')
    expect(reversed?.variant).toBe('conflict')
  })

  it('BreaksVariantTiesTowardTheEarlierCandidate_AndKeepsItsPayload', () => {
    const winner = pickBanner([b('price', 'first'), b('price', 'second')])
    expect(winner?.message).toBe('first')
  })

  it('PreservesTheFullBannerPayloadOfTheWinner', () => {
    const winner = pickBanner([
      { variant: 'note', message: 'a note' },
      { variant: 'conflict', message: '2× parallel at 14:00' },
    ])
    expect(winner).toEqual({ variant: 'conflict', message: '2× parallel at 14:00' })
  })
})

describe('BANNER_PRIORITY', () => {
  it('IsTheBindingOrderConflictPriceHealingNote', () => {
    expect(BANNER_PRIORITY).toEqual(['conflict', 'price', 'healing', 'note'])
  })
})
