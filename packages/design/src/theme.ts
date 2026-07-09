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
  densityScale,
  type Density,
} from './tokens.js'

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  readonly mode: ThemeMode
  readonly accent: AccentTheme
  readonly density: Density
  readonly color: Palette
  readonly projectColors: readonly string[]
  readonly spacing: typeof spacing
  readonly fontSize: typeof fontSize
  readonly radius: typeof radius
  readonly motion: typeof motion
  readonly fontFamily: typeof blueprintFontFamily | typeof systemFontFamily
  readonly touchTarget: number
  readonly padCard: number
  readonly gapList: number
}

export function theme(
  mode: ThemeMode,
  accent: AccentTheme = DEFAULT_ACCENT,
  density: Density = 'regular',
): Theme {
  return {
    mode,
    accent,
    density,
    color: palettes[accent][mode],
    projectColors: projectColors[mode],
    spacing,
    fontSize,
    radius,
    motion,
    fontFamily: accent === 'blueprint' ? blueprintFontFamily : systemFontFamily,
    touchTarget: densityScale[density].touchTarget,
    padCard: densityScale[density].padCard,
    gapList: densityScale[density].gapList,
  }
}

export const themes: Record<ThemeMode, Theme> = {
  dark: theme('dark'),
  light: theme('light'),
}
