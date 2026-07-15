import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { useSession } from '../hooks/useSession'
import { LoginScreen } from '../screens/LoginScreen'
import { RegisterScreen } from '../screens/RegisterScreen'
import { SessionProvider } from './SessionContext'

/**
 * AuthGate (REQ-002) — the session boundary around the app. While the session
 * loads it shows a splash; with no session it shows the Login / Register gate
 * (toggled locally); once signed in it renders the app. With no backend configured
 * there is no session, so the gate stays on Login — the app fabricates no demo user.
 */
export function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useTheme()
  const session = useSession()
  const [mode, setMode] = useState<'login' | 'register'>('login')

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
    return mode === 'register' ? (
      <RegisterScreen
        onSignUp={session.signUp}
        onSocial={session.startSocial}
        onGoLogin={() => setMode('login')}
        providers={session.providers}
        busy={session.busy}
        error={session.error}
      />
    ) : (
      <LoginScreen
        onSignIn={session.signIn}
        onSocial={session.startSocial}
        onForgot={session.requestReset}
        onGoRegister={() => setMode('register')}
        providers={session.providers}
        busy={session.busy}
        error={session.error}
      />
    )
  }

  return <SessionProvider value={session}>{children}</SessionProvider>
}
