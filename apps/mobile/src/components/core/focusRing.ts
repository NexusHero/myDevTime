import { Platform } from 'react-native'
import type { Theme } from '@mydevtime/design'

/**
 * Visible focus ring (REQ-043, ADR-0062). Keyboard focus must be *visible* on every
 * interactive control on web: while focused, a 2px accent outline sits 2px off the
 * control; while unfocused, the UA default outline is suppressed so this ring is the
 * one consistent focus treatment everywhere. On native the helper returns `{}` —
 * RN styles have no `outline*` props and the platform draws its own focus affordance
 * — so callers can spread the result unconditionally.
 */
export interface FocusRingStyle {
  readonly outlineColor?: string
  readonly outlineOffset?: number
  readonly outlineStyle?: 'solid' | 'none'
  readonly outlineWidth?: number
}

/** The web-only focus outline for an interactive control; spread into its style. */
export function focusRingStyle(t: Theme, focused: boolean): FocusRingStyle {
  if (Platform.OS !== 'web') return {}
  return focused
    ? { outlineWidth: 2, outlineStyle: 'solid', outlineColor: t.color.accent, outlineOffset: 2 }
    : { outlineStyle: 'none' }
}
