import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Button, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { AuthScaffold } from './auth/AuthScaffold'
import { OrDivider, SocialButtons } from './auth/SocialButtons'
import {
  validateCredentials,
  type AuthProviders,
  type Credentials,
  type SocialProvider,
} from '../api/auth'

/**
 * Login (REQ-002, ux-vision §4, design v8) — the gate the `AuthGate` shows with no
 * session: the dark brand panel + a warm form. Email + password go through the auth
 * seam (`validateCredentials` catches obvious mistakes before the round-trip); the
 * Google/Apple/GitHub buttons are enabled only where the provider is configured;
 * "Passwort vergessen?" emails a reset link; and a link switches to Register.
 */
export function LoginScreen({
  onSignIn,
  onSocial,
  onForgot,
  onGoRegister,
  providers,
  busy = false,
  error = null,
}: {
  onSignIn: (creds: Credentials) => Promise<void>
  onSocial: (provider: SocialProvider) => void
  onForgot: (email: string) => Promise<void>
  onGoRegister: () => void
  providers: AuthProviders
  busy?: boolean
  error?: Error | null
}): React.JSX.Element {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = (): void => {
    setNotice(null)
    const problem = validateCredentials({ email, password })
    setLocalError(problem)
    if (problem !== null) return
    void onSignIn({ email, password }).catch(() => {
      /* the session hook surfaces the failure through the `error` prop */
    })
  }

  const forgot = (): void => {
    setLocalError(null)
    setNotice(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Gib zuerst deine E-Mail ein, dann sende ich dir einen Reset-Link.')
      return
    }
    const done = (): void => setNotice('Wenn die E-Mail existiert, ist ein Reset-Link unterwegs.')
    void onForgot(email).then(done).catch(done)
  }

  const message = localError ?? error?.message ?? null
  const link = { color: t.color.accentText, fontSize: t.fontSize.sm, fontWeight: '600' as const }

  return (
    <AuthScaffold pitch={'Deine Zeit.\nGetrackt, geplant, geschützt.'}>
      <Text
        style={{
          fontSize: t.fontSize.xl,
          fontWeight: '700',
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        Willkommen zurück
      </Text>

      {message !== null && (
        <Text accessibilityRole="alert" style={{ color: t.color.crit, fontSize: t.fontSize.sm }}>
          {message}
        </Text>
      )}
      {notice !== null && (
        <Text style={{ color: t.color.good, fontSize: t.fontSize.sm }}>{notice}</Text>
      )}

      <Input
        label="E-Mail"
        placeholder="du@firma.de"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Input
        label="Passwort"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable onPress={forgot} accessibilityRole="button">
        <Text style={{ ...link, alignSelf: 'flex-end' }}>Passwort vergessen?</Text>
      </Pressable>

      <Button onPress={submit} disabled={busy}>
        {busy ? 'Anmelden…' : 'Anmelden'}
      </Button>

      <OrDivider />
      <SocialButtons providers={providers} onSocial={onSocial} label={n => n} />

      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: t.spacing.s2 }}
      >
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>Noch kein Konto?</Text>
        <Pressable onPress={onGoRegister} accessibilityRole="button">
          <Text style={link}>Kostenlos registrieren</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  )
}
