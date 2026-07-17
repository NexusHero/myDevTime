import { lifeShades } from './palette.js'
import { fnv1a } from './hash.js'
import type { ThemeMode } from './theme.js'

/**
 * Deterministic person→shade assignment for family/personal blocks (design v17 §F6).
 * Family and personal time is one timeline shared across several people — a partner,
 * the kids — but a person is **not** a project, so people never wear the saturated
 * rainbow project palette. Instead each person gets one of a few **sage** shades of
 * the `life` tone, so a life block still reads calm and clearly non-work while telling
 * family members apart. Like `projectColor`, the shade is a stable function of the
 * person id (not a counter or random pick) so the same person always renders in the
 * same shade across devices and sessions, and the slot is theme-independent so it
 * survives a mode/accent flip. The base shade (slot 0) equals the plain `life` token.
 */

/** Stable sage-shade slot (0-based) for a person id. */
export function personShadeIndex(id: string, shadeCount: number = lifeShades.dark.length): number {
  if (shadeCount <= 0) throw new Error('shadeCount must be positive')
  return fnv1a(id) % shadeCount
}

/** The person's sage shade in a given mode — stable across sessions and theme flips. */
export function personShade(id: string, mode: ThemeMode): string {
  const shades = lifeShades[mode]
  const shade = shades[personShadeIndex(id, shades.length)]
  // Unreachable: the index is `hash % shades.length` and the shade list is non-empty.
  if (shade === undefined) throw new Error('life shade list is empty')
  return shade
}
