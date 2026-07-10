import { Text as RNText, StyleSheet, type TextProps } from 'react-native'
import { resolveFontFamily } from '@mydevtime/design'

/**
 * Text — the themed text primitive (issue #11, ADR-0022 font-loading slice). It
 * reads the base font family a style already carries (`fontFamily: t.fontFamily.numeric`,
 * etc) plus the usual `fontWeight`, and resolves both via `resolveFontFamily`.
 *
 * If the theme uses the Blueprint webfonts (Inter, Space Grotesk, JetBrains Mono),
 * this maps to a concrete loaded face (e.g. `Inter_700Bold`) and nulls the CSS
 * weight so we never get synthesized faux-bold. If the theme uses native system
 * fonts (Sovereign, Ember), the family passes through and the native `fontWeight`
 * is preserved so the OS renders the correct weight.
 * Every user-visible string in the app renders through here.
 */

function weightOf(fontWeight: unknown): number {
  if (fontWeight === 'bold') return 700
  if (fontWeight === 'normal' || fontWeight === undefined) return 400
  const n = Number(fontWeight)
  return Number.isNaN(n) ? 400 : n
}

export function Text({ style, ...rest }: TextProps): React.JSX.Element {
  const flat = StyleSheet.flatten(style) ?? {}
  const rawFamily = typeof flat.fontFamily === 'string' ? flat.fontFamily : undefined
  const weight = weightOf(flat.fontWeight)

  const resolvedFamily = resolveFontFamily(rawFamily, weight)

  // If `resolveFontFamily` returned a concrete face (like 'Inter_700Bold'), it means
  // we are using the custom fonts. We must null the fontWeight so the OS doesn't apply
  // faux-bolding on top of the already bold face. If it returned `undefined` (a system
  // font marker, e.g. 'System') or passed the family through unchanged (e.g.
  // 'monospace'), we are on a system font and must preserve the fontWeight so the OS
  // renders the correct weight — comparing only against `rawFamily` would also treat
  // the `undefined` system-font case as "custom" and wrongly null the weight.
  const isCustomFace = resolvedFamily !== undefined && resolvedFamily !== rawFamily
  const finalWeight = isCustomFace ? 'normal' : flat.fontWeight

  return (
    <RNText {...rest} style={[style, { fontFamily: resolvedFamily, fontWeight: finalWeight }]} />
  )
}
