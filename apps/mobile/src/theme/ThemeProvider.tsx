import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import {
  theme,
  DEFAULT_ACCENT,
  type AccentTheme,
  type Density,
  type Theme,
} from '@mydevtime/design'
import { resolveMode, type ThemePref } from './resolveMode'

/**
 * Theme context (issue #11). Resolves the effective `Theme` from the OS color
 * scheme and the user's mode preference (pure `resolveMode`) plus the chosen
 * accent theme (Blueprint/Royal Blue default / Sovereign / Ember — ADR-0023), and hands the
 * whole design system — palette + scales — to every screen via `useTheme()`.
 * Dark-first with light a first-class sibling (ux-vision §4).
 */
interface ThemeContextValue {
  readonly theme: Theme
  readonly pref: ThemePref
  readonly setPref: (pref: ThemePref) => void
  readonly accent: AccentTheme
  readonly setAccent: (accent: AccentTheme) => void
  readonly density: Density
  readonly setDensity: (density: Density) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: theme('dark'),
  pref: 'system',
  setPref: () => undefined,
  accent: DEFAULT_ACCENT,
  setAccent: () => undefined,
  density: 'regular',
  setDensity: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const osScheme = useColorScheme() ?? null
  const [pref, setPref] = useState<ThemePref>('system')
  const [accent, setAccent] = useState<AccentTheme>(DEFAULT_ACCENT)
  const [density, setDensity] = useState<Density>('regular')
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: theme(resolveMode(pref, osScheme), accent, density),
      pref,
      setPref,
      accent,
      setAccent,
      density,
      setDensity,
    }),
    [pref, osScheme, accent, density],
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

export function useDensity(): { density: Density; setDensity: (d: Density) => void } {
  const { density, setDensity } = useContext(ThemeContext)
  return { density, setDensity }
}
