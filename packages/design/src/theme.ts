import {
  AI_GRADIENT,
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
  easing,
  radius,
  spacing,
  semanticSpacing,
  appShell,
  borderWidth,
  lineHeight,
  letterSpacing,
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
  /** AI-signature gradient stops (blue→violet→orange), theme-independent (ADR-0034). */
  readonly aiGradient: readonly [string, string, string]
  readonly spacing: typeof spacing
  readonly semanticSpacing: typeof semanticSpacing
  readonly appShell: typeof appShell
  readonly fontSize: typeof fontSize
  readonly radius: typeof radius
  readonly borderWidth: typeof borderWidth
  readonly lineHeight: typeof lineHeight
  readonly letterSpacing: typeof letterSpacing
  readonly motion: typeof motion
  readonly easing: typeof easing
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
    aiGradient: AI_GRADIENT,
    spacing,
    semanticSpacing,
    appShell,
    fontSize,
    radius,
    borderWidth,
    lineHeight,
    letterSpacing,
    motion,
    easing,
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
