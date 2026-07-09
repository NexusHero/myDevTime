import { Text as RNText, StyleSheet, type TextProps } from 'react-native'
import { fontFace, type FontRole } from '@mydevtime/design'

/**
 * Text — the themed text primitive (issue #11, ADR-0022 font-loading slice). It
 * reads the role marker a style already carries (`fontFamily: fontFamily.numeric`
 * → mono, `.display` → Space Grotesk, otherwise Inter) plus the usual `fontWeight`,
 * and resolves both to a concrete loaded face via the pure `fontFace`. So screens
 * keep writing plain `fontWeight: '700'` and get the *real* Inter Bold, never a
 * synthesized faux-bold. Every user-visible string in the app renders through here.
 */
function roleOf(family: unknown): FontRole {
  if (typeof family !== 'string') return 'ui'
  if (family.includes('Mono')) return 'numeric'
  if (family.includes('Grotesk')) return 'display'
  return 'ui'
}

function weightOf(fontWeight: unknown): number {
  if (fontWeight === 'bold') return 700
  if (fontWeight === 'normal' || fontWeight === undefined) return 400
  const n = Number(fontWeight)
  return Number.isNaN(n) ? 400 : n
}

export function Text({ style, ...rest }: TextProps): React.JSX.Element {
  const flat = StyleSheet.flatten(style) ?? {}
  const family = fontFace(roleOf(flat.fontFamily), weightOf(flat.fontWeight))
  // Concrete weighted face is applied; null the CSS weight so no double/faux bold.
  return <RNText {...rest} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />
}
