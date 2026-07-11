/**
 * `@mydevtime/design` — the settled visual language (ux-vision §4, issue #11) as
 * pure, platform-agnostic TypeScript. Tokens + theme resolver + the a11y contrast
 * math and deterministic project-color assignment. No React/RN imports, so it is
 * held to the coverage bar like the domain core and consumed identically by React
 * Native and react-native-web.
 */
export {
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
  blueprintFontFamily,
  systemFontFamily,
  resolveFontFamily,
  FONT_FACES_TO_LOAD,
  densityScale,
  gridUnit,
  type Density,
  type Spacing,
  type SemanticSpacing,
  type AppShell,
  type FontSize,
  type Radius,
  type BorderWidth,
  type LineHeight,
  type LetterSpacing,
  type Motion,
  type Easing,
} from './tokens.js'
export {
  dark,
  light,
  palettes,
  projectColors,
  AI_GRADIENT,
  ACCENT_THEMES,
  DEFAULT_ACCENT,
  type Palette,
  type AccentTheme,
} from './palette.js'
export { theme, themes, type Theme, type ThemeMode } from './theme.js'
export { projectColor, projectColorIndex } from './projects.js'
export {
  contrastRatio,
  relativeLuminance,
  parseHex,
  meetsAA,
  AA_NORMAL,
  AA_LARGE,
} from './contrast.js'
export {
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  formatSigned,
  budgetTone,
  barFraction,
  type ConsumptionTone,
} from './format.js'
export { ringDashOffset, gaugeAngle, polarToCartesian, sparklinePoints } from './instruments.js'
export { plannerBlockRect, plannerTotalHours, type BlockRect } from './planner.js'
export { monthGrid, daysInMonth, weekdayHeaders, type DayCell } from './calendar.js'

// App shell (#11): the navigation route map (deep-link build/parse for every
// screen) and the responsive width→chrome model. Pure, platform-independent.
export {
  ROUTES,
  PHONE_TABS,
  SIDEBAR_ITEMS,
  PROFILE_HUB_LINKS,
  buildPath,
  parsePath,
  type Screen,
  type RouteDef,
  type Match,
  type ProfileHubLink,
} from './nav.js'
export {
  BREAKPOINTS,
  layoutForWidth,
  chromeForWidth,
  type LayoutClass,
  type NavMode,
  type Chrome,
} from './responsive.js'
