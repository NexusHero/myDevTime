import { describe, expect, it } from 'vitest'
import { projectColor, projectColorIndex } from './projects.js'
import { projectColors } from './palette.js'

describe('deterministic project colors', () => {
  it('SameId_AlwaysSameColor', () => {
    expect(projectColor('proj-abc', 'dark')).toBe(projectColor('proj-abc', 'dark'))
    expect(projectColorIndex('proj-abc')).toBe(projectColorIndex('proj-abc'))
  })

  it('Index_IsWithinPalette', () => {
    for (const id of ['a', 'b', 'website-relaunch', 'x'.repeat(50), '42']) {
      const i = projectColorIndex(id)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(projectColors.dark.length)
    }
  })

  it('Identity_IsThemeIndependent', () => {
    // A project keeps its palette slot when the theme flips (same index → the
    // corresponding color in each theme).
    const id = 'proj-xyz'
    const i = projectColorIndex(id)
    expect(projectColor(id, 'dark')).toBe(projectColors.dark[i])
    expect(projectColor(id, 'light')).toBe(projectColors.light[i])
  })

  it('Distributes_AcrossThePalette', () => {
    const seen = new Set<number>()
    for (let n = 0; n < 40; n++) seen.add(projectColorIndex(`project-${String(n)}`))
    expect(seen.size).toBeGreaterThan(1) // not all collapsed to one color
  })

  it('EmptyPalette_Throws', () => {
    expect(() => projectColorIndex('x', 0)).toThrow()
  })
})
