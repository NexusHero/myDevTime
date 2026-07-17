import { describe, expect, it } from 'vitest'
import { AA_LARGE, AA_NORMAL, contrastRatio, meetsAA, parseHex } from './contrast.js'
import { dark, palettes, ACCENT_THEMES, type Palette } from './palette.js'

describe('WCAG contrast math', () => {
  it('KnownPairs_ComputeCorrectly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 0) // shorthand hex
  })

  it('Order_DoesNotMatter', () => {
    expect(contrastRatio(dark.ink, dark.surface)).toBe(contrastRatio(dark.surface, dark.ink))
  })

  it('ParseHex_RejectsGarbage', () => {
    expect(() => parseHex('nope')).toThrow()
    expect(() => parseHex('#12')).toThrow()
  })
})

/**
 * The palette's a11y contract, enforced as a test (ux-vision §4: "WCAG AA
 * contrast in both themes") — now across all three accents × both modes
 * (ADR-0022). A token change that breaks contrast in *any* of the six
 * combinations fails the build.
 */
const combos: readonly [string, Palette][] = ACCENT_THEMES.flatMap(accent => [
  [`${accent}/dark`, palettes[accent].dark] as [string, Palette],
  [`${accent}/light`, palettes[accent].light] as [string, Palette],
])

describe.each(combos)('%s a11y contract', (_name, p: Palette) => {
  it('PrimaryInk_ClearsAaNormalOnEverySurface', () => {
    for (const surface of [p.bg, p.surface, p.raised, p.overlay]) {
      expect(meetsAA(p.ink, surface, AA_NORMAL)).toBe(true)
    }
  })

  it('SecondaryInk_ClearsAaLargeOnSurface', () => {
    expect(meetsAA(p.ink2, p.surface, AA_LARGE)).toBe(true)
  })

  it('AccentText_ClearsAaLargeOnSurface', () => {
    // Accent-as-text is AA-tuned per theme (light uses a darker accentText).
    expect(meetsAA(p.accentText, p.surface, AA_LARGE)).toBe(true)
  })

  it('StatusColors_ClearAaLargeOnSurface', () => {
    expect(meetsAA(p.good, p.surface, AA_LARGE)).toBe(true)
    expect(meetsAA(p.crit, p.surface, AA_LARGE)).toBe(true)
    expect(meetsAA(p.warn, p.surface, AA_LARGE)).toBe(true)
  })

  it('StatusColors_ClearAaNormalOnTheirSoftFill', () => {
    // Status badges render the tone as small text on its *Soft fill, so that
    // pairing — not just tone-on-surface — must clear AA normal (4.5:1).
    expect(meetsAA(p.good, p.goodSoft, AA_NORMAL)).toBe(true)
    expect(meetsAA(p.crit, p.critSoft, AA_NORMAL)).toBe(true)
    expect(meetsAA(p.warn, p.warnSoft, AA_NORMAL)).toBe(true)
  })

  it('LiveStrong_ClearsAaLargeOnSurface', () => {
    // "Live" reads as text only via `liveStrong`; the raw `live` fill is a dot /
    // now-line and carries no text, so it is exempt from the text contract.
    expect(meetsAA(p.liveStrong, p.surface, AA_LARGE)).toBe(true)
  })

  it('Life_ClearsAaLargeOnSurface', () => {
    // The sage `life` tone labels life blocks / the capacity trace (design v14 §F),
    // so it must clear AA-Large as text on a normal surface in every combo.
    expect(meetsAA(p.life, p.surface, AA_LARGE)).toBe(true)
  })
})
