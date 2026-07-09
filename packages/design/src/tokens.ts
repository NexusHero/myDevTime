/**
 * Theme-independent design scales (ux-vision §4) — the 8-pt grid, type scale,
 * radii, and motion durations that don't change between light and dark. Values
 * are unitless numbers (points/px on the client, ms for motion) so a React
 * Native `StyleSheet` and react-native-web consume them identically.
 */

/** 8-pt spacing grid (ux-vision §4: "8-pt grid"). */
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
} as const

/** Type scale, in points. Numerals render in the monospace family (see `fontFamily`). */
export const fontSize = {
  xs: 11,
  sm: 12.5,
  base: 14,
  md: 16,
  lg: 20,
  xl: 28,
} as const

/** Corner radii per surface kind. */
export const radius = {
  chip: 6,
  block: 10,
  card: 14,
  pill: 999,
} as const

/**
 * Motion durations in ms (ux-vision §4: "150–250 ms, nothing longer in the daily
 * loop"). `spring` is for a block settling on drop; the client must gate all
 * motion behind the OS reduced-motion setting.
 */
export const motion = {
  fast: 140,
  spring: 220,
} as const

/**
 * Font families — The design system specifies two stacks: Blueprint uses the custom trio
 * (Inter, Space Grotesk, JetBrains Mono), while Sovereign and Ember use native system fonts.
 * The `theme` resolver selects the correct object based on the active accent.
 */
export const blueprintFontFamily = {
  ui: 'Inter_400Regular',
  numeric: 'JetBrainsMono_500Medium',
  display: 'SpaceGrotesk_600SemiBold',
} as const

export const systemFontFamily = {
  ui: 'System',
  numeric: 'monospace',
  display: 'System',
} as const

type FontRole = 'ui' | 'numeric' | 'display'

/** The concrete weighted families per role — exactly the faces the client loads. */
const FONT_FACES: Record<FontRole, Record<400 | 500 | 600 | 700, string>> = {
  ui: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
  numeric: {
    400: 'JetBrainsMono_500Medium',
    500: 'JetBrainsMono_500Medium',
    600: 'JetBrainsMono_600SemiBold',
    700: 'JetBrainsMono_700Bold',
  },
  display: {
    400: 'SpaceGrotesk_500Medium',
    500: 'SpaceGrotesk_500Medium',
    600: 'SpaceGrotesk_600SemiBold',
    700: 'SpaceGrotesk_700Bold',
  },
}

/** The distinct font faces to load, once, at startup (client maps each to its `.ttf`). */
export const FONT_FACES_TO_LOAD: readonly string[] = [
  ...new Set(Object.values(FONT_FACES).flatMap(byWeight => Object.values(byWeight))),
]

/** Snap an arbitrary CSS weight to the nearest loaded step. */
function snapWeight(weight: number): 400 | 500 | 600 | 700 {
  if (weight >= 700) return 700
  if (weight >= 600) return 600
  if (weight >= 500) return 500
  return 400
}

/**
 * Resolve a base family + weight to a concrete loaded font face — so a bold weight
 * renders the real bold face (never a synthesized faux-bold). If the family is a
 * system font marker ('System' or 'monospace'), it passes through unmodified.
 */
export function resolveFontFamily(family: string | undefined, weight = 400): string | undefined {
  if (!family || family === 'System') return undefined
  if (family.startsWith('Inter')) return FONT_FACES.ui[snapWeight(weight)]
  if (family.startsWith('JetBrainsMono')) return FONT_FACES.numeric[snapWeight(weight)]
  if (family.startsWith('SpaceGrotesk')) return FONT_FACES.display[snapWeight(weight)]
  return family
}

export type Density = 'regular' | 'compact'

export const densityScale: Record<
  Density,
  { touchTarget: number; padCard: number; gapList: number }
> = {
  regular: { touchTarget: 44, padCard: 20, gapList: 8 },
  compact: { touchTarget: 32, padCard: 12, gapList: 4 },
}

/** The grid unit every spacing value is a multiple of. */
export const gridUnit = 8

export type Spacing = keyof typeof spacing
export type FontSize = keyof typeof fontSize
export type Radius = keyof typeof radius
