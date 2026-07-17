import { describe, expect, it } from 'vitest'
import { inLayer, PLANNER_LAYERS } from './layer.js'

/**
 * The Planner Work/Life/Both layer filter (design v17 §F6.5): default Both shows everything;
 * Work hides `life` entries; Life shows only them. Only visibility changes, never the data.
 */
describe('inLayer', () => {
  it('BothShowsEveryKind', () => {
    for (const kind of ['actual', 'meeting', 'ghost', 'break', 'life']) {
      expect(inLayer(kind, 'both')).toBe(true)
    }
  })

  it('WorkHidesLifeAndShowsTheRest', () => {
    expect(inLayer('life', 'work')).toBe(false)
    expect(inLayer('actual', 'work')).toBe(true)
    expect(inLayer('meeting', 'work')).toBe(true)
  })

  it('LifeShowsOnlyLife', () => {
    expect(inLayer('life', 'life')).toBe(true)
    expect(inLayer('actual', 'life')).toBe(false)
    expect(inLayer('break', 'life')).toBe(false)
  })

  it('DefaultsBothFirstInThePillOrder', () => {
    expect(PLANNER_LAYERS[0]).toBe('both')
  })
})
