import { describe, expect, it } from 'vitest'
import { can, featuresFor } from './features.js'
import { FREE, type Entitlement } from './types.js'

const pro: Entitlement = {
  plan: 'pro',
  status: 'active',
  source: 'stripe',
  currentPeriodEnd: null,
  inGrace: false,
}
const pastDue: Entitlement = { ...pro, status: 'past_due', inGrace: true }

describe('feature gating', () => {
  it('Free_UnlocksOnlyBasicTracking', () => {
    expect(can(FREE, 'basic_tracking')).toBe(true)
    expect(can(FREE, 'ai_proposals')).toBe(false)
    expect(can(FREE, 'meeting_transcription')).toBe(false)
    expect(can(FREE, 'advanced_reports')).toBe(false)
  })

  it('Pro_UnlocksEverything', () => {
    expect(can(pro, 'basic_tracking')).toBe(true)
    expect(can(pro, 'ai_proposals')).toBe(true)
    expect(can(pro, 'meeting_transcription')).toBe(true)
  })

  it('PastDue_StillEntitledDuringGrace', () => {
    expect(can(pastDue, 'ai_proposals')).toBe(true)
  })

  it('FeaturesFor_ListsTheUnlockedSet', () => {
    expect(featuresFor('free')).toEqual(['basic_tracking'])
    expect(featuresFor('pro')).toContain('meeting_transcription')
    expect(featuresFor('pro').length).toBeGreaterThan(featuresFor('free').length)
  })
})
