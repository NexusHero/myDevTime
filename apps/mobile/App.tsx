import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { ThemeProvider } from './src/theme/ThemeProvider'
import { AppShell } from './src/shell/AppShell'
import { AuthGate } from './src/shell/AuthGate'
import { OnboardingGate } from './src/onboarding/OnboardingGate'
import { TimerProvider } from './src/timer/TimerContext'

/**
 * App root (issue #11): loads the Blueprint font trio (Inter · Space Grotesk ·
 * JetBrains Mono — ADR-0022's deferred font-loading slice) before painting, then
 * the design-system `ThemeProvider` wraps the responsive navigation shell. One
 * codebase renders on iOS, Android, and web (react-native-web) from here.
 *
 * The exact weight files are required directly (not via the package index) so the
 * bundle carries only the ~10 faces the design system actually uses, not every
 * weight the `@expo-google-fonts/*` packages ship. Family keys match `fontFace`.
 */
export default function App(): React.JSX.Element | null {
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

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <AuthGate>
          <OnboardingGate>
            <TimerProvider>
              <AppShell />
            </TimerProvider>
          </OnboardingGate>
        </AuthGate>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
