import { describe, expect, it } from 'vitest'
import { theme, themes } from './theme.js'
import { dark, light, palettes, ACCENT_THEMES, DEFAULT_ACCENT } from './palette.js'
import { spacing, touchTarget } from './tokens.js'

describe('theme resolver', () => {
  it('Dark_ResolvesDarkPaletteAndScales', () => {
    const t = theme('dark')
    expect(t.mode).toBe('dark')
    expect(t.color).toBe(dark)
    expect(t.spacing).toBe(spacing)
    expect(t.touchTarget).toBe(touchTarget)
    expect(t.projectColors).toHaveLength(5)
  })

  it('Light_ResolvesLightPalette', () => {
    expect(theme('light').color).toBe(light)
  })

  it('DefaultsToSovereign_TheFlagshipAccent', () => {
    // ADR-0022: no accent argument = Sovereign (the default flagship).
    expect(DEFAULT_ACCENT).toBe('sovereign')
    expect(theme('dark').accent).toBe('sovereign')
    expect(theme('dark').color).toBe(palettes.sovereign.dark)
  })

  it('Accent_SelectsThatAccentsPaletteForTheMode', () => {
    for (const accent of ACCENT_THEMES) {
      expect(theme('dark', accent).color).toBe(palettes[accent].dark)
      expect(theme('light', accent).color).toBe(palettes[accent].light)
      expect(theme('light', accent).accent).toBe(accent)
    }
  })

  it('ProjectColors_AreAccentIndependent', () => {
    // A project keeps its identity when the accent theme flips (ux-vision §4).
    expect(theme('dark', 'ember').projectColors).toBe(theme('dark', 'blueprint').projectColors)
  })

  it('Themes_ExposesBothPreResolvedAtDefaultAccent', () => {
    expect(themes.dark.mode).toBe('dark')
    expect(themes.light.mode).toBe('light')
    expect(themes.dark.accent).toBe('sovereign')
  })

  it('TouchTarget_MeetsThe44ptFloor', () => {
    expect(theme('dark').touchTarget).toBeGreaterThanOrEqual(44)
  })

  it('Spacing_IsAnEightPtGrid', () => {
    // Every step but the 4-pt half-step is a multiple of 8 (ux-vision §4).
    for (const v of [spacing.s2, spacing.s4, spacing.s5, spacing.s6, spacing.s7]) {
      expect(v % 8).toBe(0)
    }
  })
})
