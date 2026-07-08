import { describe, expect, it } from 'vitest'
import { theme, themes } from './theme.js'
import { dark, light } from './palette.js'
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

  it('Themes_ExposesBothPreResolved', () => {
    expect(themes.dark.mode).toBe('dark')
    expect(themes.light.mode).toBe('light')
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
