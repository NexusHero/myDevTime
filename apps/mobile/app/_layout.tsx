import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { ShellChrome } from '../src/shell/ShellChrome'
import { BrandSplash, hasPlayedSplash } from '../src/components/canvas/BrandSplash'
import { AuthGate } from '../src/shell/AuthGate'
import { OnboardingGate } from '../src/onboarding/OnboardingGate'
import { TimerProvider } from '../src/timer/TimerContext'
import { PomodoroProvider } from '../src/focus/PomodoroContext'
import { makeQueryClient } from '../src/query/queryClient'
import { registerPwa } from '../src/web/registerPwa'

/**
 * Expo Router root layout (ADR-0045) — the app's single entry, replacing the old
 * hand-rolled `App` + shell router. It loads the Blueprint font trio before
 * painting, then nests the providers exactly as before and renders the persistent
 * responsive chrome (`ShellChrome`), whose `<Slot />` hosts the routed screen.
 * File-based routing under `app/` gives real URLs + deep links on every platform
 * and route-level code-splitting on web (§Perf). One codebase, iOS/Android/web.
 *
 * The exact weight files are required directly (not via the package index) so the
 * bundle carries only the faces the design system actually uses. Clash Display —
 * the Sovereign/Ember display face (ADR-0061) — is self-hosted from `assets/fonts`
 * (ITF Free Font License); it is not an `@expo-google-fonts` package.
 */
export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
    SpaceGrotesk_500Medium: require('@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf'),
    SpaceGrotesk_600SemiBold: require('@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf'),
    SpaceGrotesk_700Bold: require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'),
    JetBrainsMono_500Medium: require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    JetBrainsMono_600SemiBold: require('@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf'),
    JetBrainsMono_700Bold: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
    ClashDisplay_600SemiBold: require('../assets/fonts/ClashDisplay-Semibold.ttf'),
    ClashDisplay_700Bold: require('../assets/fonts/ClashDisplay-Bold.ttf'),
  })

  // Web/PWA: link the manifest + register the app-shell service worker (installable
  // web build, #199). This caches the shell only — it does not restore offline
  // *data* (removed in ADR-0049); a client-side effect, no-op on native / during SSR.
  // Also set the document title on web — the static export ships no <title>, which
  // fails axe's `document-title` (WCAG 2.4.2, REQ-043).
  useEffect(() => {
    registerPwa()
    if (typeof document !== 'undefined' && !document.title) document.title = 'myDevTime'
  }, [])

  // One QueryClient for the app's lifetime (ADR-0047), created lazily so it is
  // stable across re-renders.
  const [queryClient] = useState(makeQueryClient)

  // The brand splash sting plays once per launch, over the app, then unmounts
  // (ADR-0061). `hasPlayedSplash` keeps it from replaying on a hot re-render.
  const [splashDone, setSplashDone] = useState(hasPlayedSplash)

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <AuthGate>
            <OnboardingGate>
              <TimerProvider>
                <PomodoroProvider>
                  <ShellChrome />
                </PomodoroProvider>
              </TimerProvider>
            </OnboardingGate>
          </AuthGate>
          {!splashDone && <BrandSplash onDone={() => setSplashDone(true)} />}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
