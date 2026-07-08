import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { theme, type Theme } from '@mydevtime/design'
import { resolveMode, type ThemePref } from './resolveMode.js'

/**
 * Theme context (issue #11). Resolves the effective `Theme` from the OS color
 * scheme and the user's preference (pure `resolveMode`), and hands the whole
 * design system — palette + scales — to every screen via `useTheme()`. Dark-first
 * with light a first-class sibling (ux-vision §4).
 */
interface ThemeContextValue {
  readonly theme: Theme
  readonly pref: ThemePref
  readonly setPref: (pref: ThemePref) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: theme('dark'),
  pref: 'system',
  setPref: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const osScheme = useColorScheme() ?? null
  const [pref, setPref] = useState<ThemePref>('system')
  const value = useMemo<ThemeContextValue>(
    () => ({ theme: theme(resolveMode(pref, osScheme)), pref, setPref }),
    [pref, osScheme],
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
