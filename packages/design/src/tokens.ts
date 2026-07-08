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
 * Font families. UI is the platform humanist sans; numerals are monospace so
 * "every duration and amount" aligns (ux-vision §4). On React Native the client
 * maps `ui` to the system font and `numeric` to a bundled/tabular mono.
 */
export const fontFamily = {
  ui: 'System',
  numeric: 'ui-monospace',
} as const

/** Minimum touch target (ux-vision §4: "44-pt minimum touch targets"). */
export const touchTarget = 44

/** The grid unit every spacing value is a multiple of. */
export const gridUnit = 8

export type Spacing = keyof typeof spacing
export type FontSize = keyof typeof fontSize
export type Radius = keyof typeof radius
