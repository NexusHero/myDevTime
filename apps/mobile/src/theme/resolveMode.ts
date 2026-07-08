import type { ThemeMode } from '@mydevtime/design'

/**
 * Pure theme-mode resolution (issue #11). Kept out of the React component so it
 * is unit-tested in the normal gate: the user's explicit preference overrides
 * the OS color scheme (ux-vision §4), and when the preference is `system` we
 * follow the OS — defaulting to **dark** (dark-first) when the OS scheme is
 * unknown/null.
 */
export type ThemePref = 'system' | 'dark' | 'light'

export function resolveMode(pref: ThemePref, osScheme: 'dark' | 'light' | null): ThemeMode {
  if (pref === 'system') return osScheme ?? 'dark'
  return pref
}
