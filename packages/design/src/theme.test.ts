import { describe, expect, it } from 'vitest'
import { theme, themes } from './theme.js'
import { dark, light, palettes, ACCENT_THEMES, DEFAULT_ACCENT } from './palette.js'
import { spacing, densityScale } from './tokens.js'

describe('theme resolver', () => {
  it('Dark_ResolvesDarkPaletteAndScales', () => {
    const t = theme('dark')
    expect(t.mode).toBe('dark')
    expect(t.color).toBe(dark)
    expect(t.spacing).toBe(spacing)
    expect(t.touchTarget).toBe(densityScale.regular.touchTarget)
    expect(t.projectColors).toHaveLength(12)
  })

  it('Light_ResolvesLightPalette', () => {
    expect(theme('light').color).toBe(light)
  })

  it('DefaultsToBlueprint_TheKönigsblauAccent', () => {
    // ADR-0023 (supersedes ADR-0022): no accent argument = Blueprint (Königsblau).
    expect(DEFAULT_ACCENT).toBe('blueprint')
    expect(theme('dark').accent).toBe('blueprint')
    expect(theme('dark').color).toBe(palettes.blueprint.dark)
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
    expect(themes.dark.accent).toBe('blueprint')
  })

  it('Density_AffectsSpacingTokens', () => {
    expect(theme('dark', 'blueprint', 'compact').touchTarget).toBe(32)
    expect(theme('dark', 'blueprint', 'regular').touchTarget).toBe(44)
    expect(theme('dark').touchTarget).toBeGreaterThanOrEqual(44) // Default is regular
  })

  it('Spacing_IsAnEightPtGrid', () => {
    // Every step but the 4-pt half-step is a multiple of 8 (ux-vision §4).
    for (const v of [spacing.s2, spacing.s4, spacing.s5, spacing.s6, spacing.s7]) {
      expect(v % 8).toBe(0)
    }
  })
})
