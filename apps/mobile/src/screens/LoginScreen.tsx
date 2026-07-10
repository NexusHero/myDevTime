import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Button, Card, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { validateCredentials, type Credentials } from '../api/auth'

/**
 * Login (REQ-002, ux-vision §4) — the gate the `AuthGate` shows when there is no
 * session. Email + password go through the auth seam; the pre-flight
 * `validateCredentials` catches obvious mistakes before the round-trip, and the
 * server's error surfaces below the form. Social providers (Google/Apple/GitHub,
 * ADR-0018) arrive in a later slice. In demo mode the gate never reaches here.
 */
export function LoginScreen({
  onSignIn,
  busy = false,
  error = null,
}: {
  onSignIn: (creds: Credentials) => Promise<void>
  busy?: boolean
  error?: Error | null
}): React.JSX.Element {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (): void => {
    const problem = validateCredentials({ email, password })
    setLocalError(problem)
    if (problem !== null) return
    void onSignIn({ email, password }).catch(() => {
      /* the session hook surfaces the failure through the `error` prop */
    })
  }

  const message = localError ?? error?.message ?? null

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing.s5 }}
    >
      <View style={{ alignSelf: 'center', width: '100%', maxWidth: 380, gap: t.spacing.s4 }}>
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: t.fontSize.xl,
              fontWeight: '700',
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
            }}
          >
            myDevTime
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
            Sign in to your workspace
          </Text>
        </View>

        <Card>
          <View style={{ gap: t.spacing.s3 }}>
            <Input
              label="Email"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {message !== null && (
              <Text style={{ color: t.color.crit, fontSize: t.fontSize.sm }}>{message}</Text>
            )}
            <Button onPress={submit} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </View>
        </Card>

        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, textAlign: 'center' }}>
          Google, Apple & GitHub sign-in arrive with the social-login slice.
        </Text>
      </View>
    </ScrollView>
  )
}
