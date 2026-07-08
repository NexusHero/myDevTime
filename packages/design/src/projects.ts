import { projectColors } from './palette.js'
import type { ThemeMode } from './theme.js'

/**
 * Deterministic project→color assignment. Project colors are the data color
 * (ux-vision §4), so each project must always render in the *same* color across
 * devices and sessions — that means a stable function of the project id, not a
 * counter or random pick. A small FNV-1a hash maps the id onto the categorical
 * palette; the same id always lands on the same slot, and the slot is
 * theme-independent so a project keeps its identity when the theme flips.
 */

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

function hash(id: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0 // unsigned
}

/** Stable palette slot (0-based) for a project id. */
export function projectColorIndex(
  id: string,
  paletteSize: number = projectColors.dark.length,
): number {
  if (paletteSize <= 0) throw new Error('paletteSize must be positive')
  return hash(id) % paletteSize
}

/** The project's color in a given theme — stable across sessions and theme flips. */
export function projectColor(id: string, mode: ThemeMode): string {
  const palette = projectColors[mode]
  const color = palette[projectColorIndex(id, palette.length)]
  // Unreachable: the index is `hash % palette.length` and the palette is non-empty.
  if (color === undefined) throw new Error('project palette is empty')
  return color
}
