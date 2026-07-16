import { describe, expect, it } from 'vitest'
import {
  dark,
  light,
  palettes,
  projectColors,
  ACCENT_THEMES,
  DEFAULT_ACCENT,
  type Palette,
} from './palette.js'

const NEUTRAL_KEYS: readonly (keyof Palette)[] = [
  'bg',
  'surface',
  'raised',
  'sunk',
  'overlay',
  'border',
  'borderStrong',
  'ink',
  'ink2',
  'ink3',
  'good',
  'crit',
  'warn',
  'goodSoft',
  'critSoft',
  'warnSoft',
  'aiSoft',
  'aiInk',
]

const ACCENT_KEYS: readonly (keyof Palette)[] = ['accent', 'accentInk', 'accentText', 'accentSoft']

describe('palette composition (3 accents × 2 modes)', () => {
  it('ExposesThreeAccents_SovereignDefault', () => {
    expect(ACCENT_THEMES).toEqual(['sovereign', 'ember', 'blueprint'])
    // ADR-0061 (supersedes ADR-0023): Sovereign royal blue is the flagship default.
    expect(DEFAULT_ACCENT).toBe('sovereign')
  })

  it('DarkAndLight_AliasTheDefaultSovereignPalettes', () => {
    expect(dark).toBe(palettes.sovereign.dark)
    expect(light).toBe(palettes.sovereign.light)
  })

  it('NeutralsAreSharedAcrossAccents_PerMode', () => {
    // The mode-dependent, accent-independent half is identical for every accent.
    for (const key of NEUTRAL_KEYS) {
      const darkValues = ACCENT_THEMES.map(a => palettes[a].dark[key])
      const lightValues = ACCENT_THEMES.map(a => palettes[a].light[key])
      expect(new Set(darkValues).size).toBe(1)
      expect(new Set(lightValues).size).toBe(1)
    }
  })

  it('AccentTokensDiffer_BetweenAccents', () => {
    // Each accent brings a distinct `accent` fill (the whole point of the axis).
    const fills = ACCENT_THEMES.map(a => palettes[a].light.accent)
    expect(new Set(fills).size).toBe(ACCENT_THEMES.length)
  })

  it('EveryComboIsAFullPalette_NoMissingTokens', () => {
    const allKeys = [...NEUTRAL_KEYS, ...ACCENT_KEYS]
    for (const accent of ACCENT_THEMES) {
      for (const p of [palettes[accent].dark, palettes[accent].light]) {
        for (const key of allKeys) {
          expect(p[key], `${accent}.${key}`).toBeTruthy()
        }
      }
    }
  })

  it('SurfacesAreNearBlackOnDark_NeverPureBlack', () => {
    // ux-vision §4: near-black surfaces, never pure #000.
    for (const surface of [dark.bg, dark.surface, dark.raised, dark.overlay]) {
      expect(surface).not.toBe('#000000')
      expect(surface).not.toBe('#000')
    }
  })

  it('ProjectColors_AreTwelvePerMode', () => {
    expect(projectColors.dark).toHaveLength(12)
    expect(projectColors.light).toHaveLength(12)
  })
})
