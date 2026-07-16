import { describe, expect, it } from 'vitest'
import { FONT_FACES_TO_LOAD, resolveFontFamily } from './tokens.js'

describe('resolveFontFamily', () => {
  it('resolveFontFamily_Inter_MapToInterFaces', () => {
    expect(resolveFontFamily('Inter_400Regular')).toBe('Inter_400Regular')
    expect(resolveFontFamily('Inter_400Regular', 600)).toBe('Inter_600SemiBold')
    expect(resolveFontFamily('Inter_400Regular', 700)).toBe('Inter_700Bold')
  })

  it('resolveFontFamily_JetBrainsMono_MapToJetBrainsMonoFaces', () => {
    expect(resolveFontFamily('JetBrainsMono_500Medium')).toBe('JetBrainsMono_500Medium')
    expect(resolveFontFamily('JetBrainsMono_500Medium', 700)).toBe('JetBrainsMono_700Bold')
  })

  it('resolveFontFamily_SpaceGrotesk_MapToSpaceGroteskFaces', () => {
    expect(resolveFontFamily('SpaceGrotesk_600SemiBold', 600)).toBe('SpaceGrotesk_600SemiBold')
    expect(resolveFontFamily('SpaceGrotesk_600SemiBold', 700)).toBe('SpaceGrotesk_700Bold')
  })

  it('resolveFontFamily_ClashDisplay_MapsToClashFaces_SemiboldAndBold', () => {
    // Clash Display is the Sovereign/Ember display face (ADR-0061). Only Semibold +
    // Bold ship as native faces, so lighter weights snap up to Semibold.
    expect(resolveFontFamily('ClashDisplay_600SemiBold')).toBe('ClashDisplay_600SemiBold')
    expect(resolveFontFamily('ClashDisplay_600SemiBold', 500)).toBe('ClashDisplay_600SemiBold')
    expect(resolveFontFamily('ClashDisplay_600SemiBold', 700)).toBe('ClashDisplay_700Bold')
  })

  it('resolveFontFamily_SystemFonts_PassThrough', () => {
    expect(resolveFontFamily(undefined)).toBeUndefined()
    expect(resolveFontFamily('System')).toBeUndefined()
    expect(resolveFontFamily('monospace')).toBe('monospace')
  })

  it('resolveFontFamily_SnapsArbitraryWeightsToNearestStep', () => {
    expect(resolveFontFamily('Inter_400Regular', 550)).toBe('Inter_500Medium')
    expect(resolveFontFamily('Inter_400Regular', 999)).toBe('Inter_700Bold')
    expect(resolveFontFamily('Inter_400Regular', 100)).toBe('Inter_400Regular')
  })

  it('fontFacesToLoad_IsDeduped_AndCoversEveryRole', () => {
    // No duplicates, and each family family we reference is present exactly once.
    expect(new Set(FONT_FACES_TO_LOAD).size).toBe(FONT_FACES_TO_LOAD.length)
    expect(FONT_FACES_TO_LOAD).toContain('Inter_700Bold')
    expect(FONT_FACES_TO_LOAD).toContain('JetBrainsMono_700Bold')
    expect(FONT_FACES_TO_LOAD).toContain('SpaceGrotesk_600SemiBold')
    expect(FONT_FACES_TO_LOAD).toContain('ClashDisplay_600SemiBold')
    expect(FONT_FACES_TO_LOAD).toContain('ClashDisplay_700Bold')
  })
})
