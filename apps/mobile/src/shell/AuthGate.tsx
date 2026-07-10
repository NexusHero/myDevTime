import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { useSession } from '../hooks/useSession'
import { LoginScreen } from '../screens/LoginScreen'

/**
 * AuthGate (REQ-002) — the session boundary around the app. While the session
 * loads it shows a splash; with no session it shows `LoginScreen`; once signed in
 * it renders the app. In demo mode (no API configured) the session resolves a demo
 * user, so the gate is transparent and the app runs exactly as before.
 */
export function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useTheme()
  const session = useSession()

  if (session.loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={t.color.accent} />
      </View>
    )
  }

  if (session.user === null) {
    return <LoginScreen onSignIn={session.signIn} busy={session.busy} error={session.error} />
  }

  return <>{children}</>
}
