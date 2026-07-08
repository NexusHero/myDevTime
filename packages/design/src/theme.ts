import { dark, light, projectColors, type Palette } from './palette.js'
import { fontFamily, fontSize, motion, radius, spacing, touchTarget } from './tokens.js'

/**
 * A resolved theme: the theme-dependent palette plus the theme-independent
 * scales, bundled so a client reads everything off one object
 * (`theme.color.accent`, `theme.spacing.s4`). `mode` is the user's explicit
 * choice, which overrides the OS preference (ux-vision §4: "user toggle beats OS
 * preference"); the client resolves the effective mode and passes it here.
 */
export type ThemeMode = 'dark' | 'light'

export interface Theme {
  readonly mode: ThemeMode
  readonly color: Palette
  readonly projectColors: readonly string[]
  readonly spacing: typeof spacing
  readonly fontSize: typeof fontSize
  readonly radius: typeof radius
  readonly motion: typeof motion
  readonly fontFamily: typeof fontFamily
  readonly touchTarget: typeof touchTarget
}

export function theme(mode: ThemeMode): Theme {
  return {
    mode,
    color: mode === 'dark' ? dark : light,
    projectColors: projectColors[mode],
    spacing,
    fontSize,
    radius,
    motion,
    fontFamily,
    touchTarget,
  }
}

/** Both themes, pre-resolved — handy for a catalog rendering light and dark side by side. */
export const themes: Record<ThemeMode, Theme> = {
  dark: theme('dark'),
  light: theme('light'),
}
