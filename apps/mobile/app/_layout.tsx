import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { ShellChrome } from '../src/shell/ShellChrome'
import { AuthGate } from '../src/shell/AuthGate'
import { OnboardingGate } from '../src/onboarding/OnboardingGate'
import { TimerProvider } from '../src/timer/TimerContext'
import { LocalDbProvider } from '../src/localDb/LocalDbProvider'
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
 * bundle carries only the ~10 faces the design system actually uses.
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
  })

  // Web/PWA: link the manifest + register the offline service worker. In an effect
  // so it only runs client-side (never during the static web prerender); a no-op
  // on native and where the browser APIs are absent.
  useEffect(() => {
    registerPwa()
  }, [])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <LocalDbProvider>
        <ThemeProvider>
          <StatusBar style="auto" />
          <AuthGate>
            <OnboardingGate>
              <TimerProvider>
                <ShellChrome />
              </TimerProvider>
            </OnboardingGate>
          </AuthGate>
        </ThemeProvider>
      </LocalDbProvider>
    </SafeAreaProvider>
  )
}
