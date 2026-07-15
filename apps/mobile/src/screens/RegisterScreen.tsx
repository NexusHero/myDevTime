import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Button, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { AuthScaffold } from './auth/AuthScaffold'
import { OrDivider, SocialButtons } from './auth/SocialButtons'
import {
  validateSignUp,
  type AuthProviders,
  type SignUpInput,
  type SocialProvider,
} from '../api/auth'

/**
 * Register (REQ-002, design v8) — create an account: social sign-up first (only the
 * configured providers are enabled), then name + email + password through the auth
 * seam. On success the `AuthGate` swaps to the app; if the server requires email
 * verification first, a calm notice tells the user to check their inbox. A link
 * switches back to Login.
 */
function passwordHint(pw: string): string {
  if (pw.length === 0) return 'Mindestens 8 Zeichen — Zahlen oder Sonderzeichen machen es stärker.'
  if (pw.length < 8) return `${String(8 - pw.length)} Zeichen fehlen noch.`
  return 'Passt — starkes Passwort.'
}

export function RegisterScreen({
  onSignUp,
  onSocial,
  onGoLogin,
  providers,
  busy = false,
  error = null,
}: {
  onSignUp: (input: SignUpInput) => Promise<boolean>
  onSocial: (provider: SocialProvider) => void
  onGoLogin: () => void
  providers: AuthProviders
  busy?: boolean
  error?: Error | null
}): React.JSX.Element {
  const t = useTheme()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [verifyNotice, setVerifyNotice] = useState(false)

  const submit = (): void => {
    setVerifyNotice(false)
    const problem = validateSignUp({ name, email, password })
    setLocalError(problem)
    if (problem !== null) return
    void onSignUp({ name, email, password })
      .then(signedIn => {
        // signedIn === true → AuthGate swaps to the app; false → verify email first.
        if (!signedIn) setVerifyNotice(true)
      })
      .catch(() => {
        /* surfaced via the `error` prop */
      })
  }

  const message = localError ?? error?.message ?? null
  const link = { color: t.color.accentText, fontSize: t.fontSize.sm, fontWeight: '600' as const }

  if (verifyNotice) {
    return (
      <AuthScaffold pitch={'In 2 Minuten\nzur ersten getrackten Stunde.'}>
        <Text
          style={{
            fontSize: t.fontSize.xl,
            fontWeight: '700',
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
          }}
        >
          Fast geschafft
        </Text>
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>
          Wir haben dir eine Bestätigungs-E-Mail an {email} geschickt. Bestätige sie, dann kannst du
          dich anmelden.
        </Text>
        <Button onPress={onGoLogin}>Zur Anmeldung</Button>
      </AuthScaffold>
    )
  }

  return (
    <AuthScaffold pitch={'In 2 Minuten\nzur ersten getrackten Stunde.'}>
      <Text
        style={{
          fontSize: t.fontSize.xl,
          fontWeight: '700',
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        Konto erstellen
      </Text>

      <SocialButtons
        providers={providers}
        onSocial={onSocial}
        label={n => `Mit ${n} registrieren`}
      />
      <OrDivider />

      {message !== null && (
        <Text accessibilityRole="alert" style={{ color: t.color.crit, fontSize: t.fontSize.sm }}>
          {message}
        </Text>
      )}

      <Input label="Name" placeholder="Suhay Sevinc" value={name} onChangeText={setName} />
      <Input
        label="E-Mail"
        placeholder="du@firma.de"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <View style={{ gap: 4 }}>
        <Input
          label="Passwort"
          placeholder="Mindestens 8 Zeichen"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text
          style={{
            fontSize: t.fontSize.xs,
            color: password.length >= 8 ? t.color.good : t.color.ink3,
          }}
        >
          {passwordHint(password)}
        </Text>
      </View>

      <Button onPress={submit} disabled={busy}>
        {busy ? 'Wird erstellt…' : 'Konto erstellen'}
      </Button>

      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
        Mit der Registrierung akzeptierst du die AGB und die Datenschutzerklärung. Dein
        Auto-Tracking bleibt lokal, bis du es teilst.
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>Schon ein Konto?</Text>
        <Pressable onPress={onGoLogin} accessibilityRole="button">
          <Text style={link}>Anmelden</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  )
}
