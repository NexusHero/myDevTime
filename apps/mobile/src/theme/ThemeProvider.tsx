import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { theme, DEFAULT_ACCENT, type AccentTheme, type Theme } from '@mydevtime/design'
import { resolveMode, type ThemePref } from './resolveMode'

/**
 * Theme context (issue #11). Resolves the effective `Theme` from the OS color
 * scheme and the user's mode preference (pure `resolveMode`) plus the chosen
 * accent theme (Sovereign default / Ember / Blueprint — ADR-0022), and hands the
 * whole design system — palette + scales — to every screen via `useTheme()`.
 * Dark-first with light a first-class sibling (ux-vision §4).
 */
interface ThemeContextValue {
  readonly theme: Theme
  readonly pref: ThemePref
  readonly setPref: (pref: ThemePref) => void
  readonly accent: AccentTheme
  readonly setAccent: (accent: AccentTheme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: theme('dark'),
  pref: 'system',
  setPref: () => undefined,
  accent: DEFAULT_ACCENT,
  setAccent: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const osScheme = useColorScheme() ?? null
  const [pref, setPref] = useState<ThemePref>('system')
  const [accent, setAccent] = useState<AccentTheme>(DEFAULT_ACCENT)
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: theme(resolveMode(pref, osScheme), accent),
      pref,
      setPref,
      accent,
      setAccent,
    }),
    [pref, osScheme, accent],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme
}

export function useThemePref(): { pref: ThemePref; setPref: (p: ThemePref) => void } {
  const { pref, setPref } = useContext(ThemeContext)
  return { pref, setPref }
}

export function useAccent(): { accent: AccentTheme; setAccent: (a: AccentTheme) => void } {
  const { accent, setAccent } = useContext(ThemeContext)
  return { accent, setAccent }
}
