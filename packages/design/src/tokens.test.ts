import { describe, expect, it } from 'vitest'
import { FONT_FACES_TO_LOAD, fontFace } from './tokens.js'

describe('fontFace', () => {
  it('fontFace_UiWeights_MapToInterFaces', () => {
    expect(fontFace('ui')).toBe('Inter_400Regular')
    expect(fontFace('ui', 600)).toBe('Inter_600SemiBold')
    expect(fontFace('ui', 700)).toBe('Inter_700Bold')
  })

  it('fontFace_NumericWeights_MapToJetBrainsMonoFaces', () => {
    expect(fontFace('numeric')).toBe('JetBrainsMono_500Medium')
    expect(fontFace('numeric', 700)).toBe('JetBrainsMono_700Bold')
  })

  it('fontFace_DisplayWeights_MapToSpaceGroteskFaces', () => {
    expect(fontFace('display', 600)).toBe('SpaceGrotesk_600SemiBold')
    expect(fontFace('display', 700)).toBe('SpaceGrotesk_700Bold')
  })

  it('fontFace_SnapsArbitraryWeightsToNearestStep', () => {
    expect(fontFace('ui', 550)).toBe('Inter_500Medium')
    expect(fontFace('ui', 999)).toBe('Inter_700Bold')
    expect(fontFace('ui', 100)).toBe('Inter_400Regular')
  })

  it('fontFacesToLoad_IsDeduped_AndCoversEveryRole', () => {
    // No duplicates, and each family family we reference is present exactly once.
    expect(new Set(FONT_FACES_TO_LOAD).size).toBe(FONT_FACES_TO_LOAD.length)
    expect(FONT_FACES_TO_LOAD).toContain('Inter_700Bold')
    expect(FONT_FACES_TO_LOAD).toContain('JetBrainsMono_700Bold')
    expect(FONT_FACES_TO_LOAD).toContain('SpaceGrotesk_600SemiBold')
  })
})
