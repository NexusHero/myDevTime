import {
  DEFAULT_ACCENT,
  palettes,
  projectColors,
  type AccentTheme,
  type Palette,
} from './palette.js'
import {
  blueprintFontFamily,
  systemFontFamily,
  fontSize,
  motion,
  radius,
  spacing,
  touchTarget,
} from './tokens.js'

/**
 * A resolved theme: the theme-dependent palette plus the theme-independent
 * scales, bundled so a client reads everything off one object
 * (`theme.color.accent`, `theme.spacing.s4`). The system has two independent axes
 * (ADR-0022): `accent` (Sovereign default / Ember / Blueprint) and `mode`
 * (light/dark). `mode` is the user's explicit choice, which overrides the OS
 * preference (ux-vision §4: "user toggle beats OS preference"); the client
 * resolves the effective mode and passes it here.
 */
export type ThemeMode = 'dark' | 'light'

export interface Theme {
  readonly mode: ThemeMode
  readonly accent: AccentTheme
  readonly color: Palette
  readonly projectColors: readonly string[]
  readonly spacing: typeof spacing
  readonly fontSize: typeof fontSize
  readonly radius: typeof radius
  readonly motion: typeof motion
  readonly fontFamily: typeof blueprintFontFamily | typeof systemFontFamily
  readonly touchTarget: typeof touchTarget
}

export function theme(mode: ThemeMode, accent: AccentTheme = DEFAULT_ACCENT): Theme {
  return {
    mode,
    accent,
    color: palettes[accent][mode],
    projectColors: projectColors[mode],
    spacing,
    fontSize,
    radius,
    motion,
    fontFamily: accent === 'blueprint' ? blueprintFontFamily : systemFontFamily,
    touchTarget,
  }
}

/**
 * The default-accent (Blueprint) themes, pre-resolved — handy for a catalog
 * rendering light and dark side by side. Use `theme(mode, accent)` for a specific
 * accent.
 */
export const themes: Record<ThemeMode, Theme> = {
  dark: theme('dark'),
  light: theme('light'),
}
