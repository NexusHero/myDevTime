import { describe, expect, it } from 'vitest'
import { personShade, personShadeIndex } from './people.js'
import { lifeShades, dark, light } from './palette.js'

describe('deterministic person shades (§F6)', () => {
  it('SameId_AlwaysSameShade', () => {
    expect(personShade('partner-anna', 'dark')).toBe(personShade('partner-anna', 'dark'))
    expect(personShadeIndex('partner-anna')).toBe(personShadeIndex('partner-anna'))
  })

  it('Index_IsWithinTheSageShades', () => {
    for (const id of ['a', 'partner', 'kid-1', 'x'.repeat(50), '42']) {
      const i = personShadeIndex(id)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(lifeShades.dark.length)
    }
  })

  it('Identity_IsThemeIndependent', () => {
    // A person keeps their sage slot when the mode flips.
    const id = 'partner-xyz'
    const i = personShadeIndex(id)
    expect(personShade(id, 'dark')).toBe(lifeShades.dark[i])
    expect(personShade(id, 'light')).toBe(lifeShades.light[i])
  })

  it('BaseShade_EqualsThePlainLifeToken', () => {
    // Slot 0 is the existing `life` tone: a lone person reads as ordinary "life".
    expect(lifeShades.dark[0]).toBe(dark.life)
    expect(lifeShades.light[0]).toBe(light.life)
  })

  it('ShadesAreDistinct_soFamilyMembersTellApart', () => {
    // The three sage tints are all different in each mode (no accidental dupes).
    expect(new Set(lifeShades.dark).size).toBe(lifeShades.dark.length)
    expect(new Set(lifeShades.light).size).toBe(lifeShades.light.length)
  })

  it('Distributes_AcrossTheShades', () => {
    const seen = new Set<number>()
    for (let n = 0; n < 30; n++) seen.add(personShadeIndex(`person-${String(n)}`))
    expect(seen.size).toBeGreaterThan(1) // not all collapsed to one shade
  })

  it('EmptyShadeList_Throws', () => {
    expect(() => personShadeIndex('x', 0)).toThrow()
  })
})
