/**
 * The brand line-icon set — 24px grid, 2px stroke, round caps, currentColor.
 * Extend the set in ICON_PATHS (same grid/stroke) instead of importing a CDN set.
 */
export interface IconProps {
  /** Glyph name: today | timer | planner | projects | reports | meetings | profile | assistant | settings | play | pause | stop | record | mic | break | plus | check | x | search | export | edit | chevronLeft | chevronRight */
  name?: string
  /** @default 20 */
  size?: number
  /** @default 2 */
  strokeWidth?: number
  style?: object
}
