import { useRouter } from 'expo-router'
import { buildPath, type Screen } from '@mydevtime/design'

/**
 * Bridges the screens' existing `onNavigate(screen, params)` / `onBack` contract
 * onto Expo Router (ADR-0045). Screens keep their prop signatures untouched — the
 * route files inject this adapter — so navigation now flows through real URLs
 * (`buildPath` from the design nav model) while the screen code is unchanged.
 */
export interface ShellNav {
  readonly onNavigate: (screen: Screen, params?: Record<string, string>) => void
  readonly onBack: () => void
}

export function useShellNav(): ShellNav {
  const router = useRouter()
  return {
    onNavigate: (screen, params) => {
      router.push(buildPath(screen, params))
    },
    onBack: () => {
      router.back()
    },
  }
}
