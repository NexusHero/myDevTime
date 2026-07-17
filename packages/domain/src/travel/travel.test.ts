import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import {
  effectiveFraction,
  frequentRoutes,
  nextLegStart,
  priceTravel,
  returnTrip,
  type TravelLeg,
  type TravelRatePolicy,
} from './travel.js'

/**
 * Acceptance for the travel entry type (REQ-051, design v13 G4). Travel time is billed
 * at a reduced fraction plus a per-km allowance — except a train, which counts as full
 * worktime. The G4b niceties (return nudge, chaining, favourites) are pure proposals.
 */
const policy: TravelRatePolicy = {
  timeRatePerHourMinor: 10_000, // 100.00 / h
  timeFraction: 0.5,
  perKmMinor: 30, // 0.30 / km
  trainCountsAsWorktime: true,
}

const leg = (over: Partial<TravelLeg> = {}): TravelLeg => ({
  id: 't1',
  from: 'Home',
  to: 'Client HQ',
  startMs: 0,
  endMs: 2 * HOUR_MS,
  distanceKm: 40,
  mode: 'car',
  ...over,
})

describe('priceTravel', () => {
  it('BillsCarTimeAtTheReducedFractionPlusMileage', () => {
    const c = priceTravel(leg(), policy)
    // 2h × 50% = 1h worktime at 100.00 = 10000 minor; 40km × 0.30 = 1200 minor.
    expect(c.appliedFraction).toBe(0.5)
    expect(c.worktimeMs).toBe(1 * HOUR_MS)
    expect(c.timeMinor).toBe(10_000)
    expect(c.distanceMinor).toBe(1_200)
    expect(c.totalMinor).toBe(11_200)
  })

  it('CountsATrainAsFullWorktime', () => {
    const c = priceTravel(leg({ mode: 'train' }), policy)
    expect(c.appliedFraction).toBe(1)
    expect(c.worktimeMs).toBe(2 * HOUR_MS)
    expect(c.timeMinor).toBe(20_000)
  })

  it('DiscountsATrainWhenThePolicySaysOtherwise', () => {
    const c = priceTravel(leg({ mode: 'train' }), { ...policy, trainCountsAsWorktime: false })
    expect(c.appliedFraction).toBe(0.5)
  })

  it('RejectsNegativeDistance', () => {
    expect(() => priceTravel(leg({ distanceKm: -1 }), policy)).toThrow()
  })
})

describe('effectiveFraction', () => {
  it('ClampsToTheUnitInterval', () => {
    expect(effectiveFraction('car', { ...policy, timeFraction: 2 })).toBe(1)
    expect(effectiveFraction('car', { ...policy, timeFraction: -1 })).toBe(0)
  })
})

describe('returnTrip', () => {
  it('MirrorsTheEndpointsKeepingDistanceAndMode', () => {
    const r = returnTrip(leg({ mode: 'train' }))
    expect(r).toEqual({ from: 'Client HQ', to: 'Home', distanceKm: 40, mode: 'train' })
  })
})

describe('nextLegStart', () => {
  it('ChainsFromTheMostRecentDestination', () => {
    const a = leg({ id: 'a', from: 'Home', to: 'A', endMs: 1 * HOUR_MS })
    const b = leg({ id: 'b', from: 'A', to: 'B', startMs: 2 * HOUR_MS, endMs: 3 * HOUR_MS })
    expect(nextLegStart([a, b])).toBe('B')
    expect(nextLegStart([])).toBeNull()
  })
})

describe('frequentRoutes', () => {
  it('RanksRoutesByFrequencyAndPreservesLabelsWithSpaces', () => {
    const legs = [
      leg({ id: '1', from: 'Home Office', to: 'Client HQ', endMs: 1 }),
      leg({ id: '2', from: 'Home Office', to: 'Client HQ', endMs: 2, distanceKm: 42 }),
      leg({ id: '3', from: 'Home Office', to: 'Gym', endMs: 3 }),
    ]
    const routes = frequentRoutes(legs)
    expect(routes[0]).toEqual({ from: 'Home Office', to: 'Client HQ', count: 2, distanceKm: 42 })
    expect(routes[1]?.to).toBe('Gym')
  })
})
