import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider } from './src/theme/ThemeProvider.js'
import { AppShell } from './src/shell/AppShell.js'

/**
 * App root (issue #11): the design-system `ThemeProvider` wraps the responsive
 * navigation shell. One codebase renders on iOS, Android, and web (react-native-
 * web) from here — `npx expo start`, then press i / a / w.
 */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
