/**
 * `@mydevtime/design` — the settled visual language (ux-vision §4, issue #11) as
 * pure, platform-agnostic TypeScript. Tokens + theme resolver + the a11y contrast
 * math and deterministic project-color assignment. No React/RN imports, so it is
 * held to the coverage bar like the domain core and consumed identically by React
 * Native and react-native-web.
 */
export {
  spacing,
  fontSize,
  radius,
  motion,
  fontFamily,
  touchTarget,
  gridUnit,
  type Spacing,
  type FontSize,
  type Radius,
} from './tokens.js'
export { dark, light, projectColors, type Palette } from './palette.js'
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
