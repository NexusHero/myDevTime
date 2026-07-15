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
  if (pw.length === 0) return 'At least 8 characters — numbers or symbols make it stronger.'
  if (pw.length < 8) return `${String(8 - pw.length)} more characters needed.`
  return 'Looks good — strong password.'
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
      <AuthScaffold pitch={'In 2 minutes\nto your first tracked hour.'}>
        <Text
          style={{
            fontSize: t.fontSize.xl,
            fontWeight: '700',
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
          }}
        >
          Almost there
        </Text>
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>
          We’ve sent a confirmation email to {email}. Confirm it, then you can sign in.
        </Text>
        <Button onPress={onGoLogin}>Go to sign in</Button>
      </AuthScaffold>
    )
  }

  return (
    <AuthScaffold pitch={'In 2 minutes\nto your first tracked hour.'}>
      <Text
        style={{
          fontSize: t.fontSize.xl,
          fontWeight: '700',
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        Create free account
      </Text>

      <SocialButtons providers={providers} onSocial={onSocial} label={n => `Sign up with ${n}`} />
      <OrDivider />

      {message !== null && (
        <Text accessibilityRole="alert" style={{ color: t.color.crit, fontSize: t.fontSize.sm }}>
          {message}
        </Text>
      )}

      <Input label="Name" placeholder="Suhay Sevinc" value={name} onChangeText={setName} />
      <Input
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <View style={{ gap: 4 }}>
        <Input
          label="Password"
          placeholder="At least 8 characters"
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
        {busy ? 'Creating…' : 'Create free account'}
      </Button>

      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
        By creating an account you accept the Terms and the Privacy Policy. Your auto-tracking stays
        local until you share it.
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>
          Already have an account?
        </Text>
        <Pressable onPress={onGoLogin} accessibilityRole="button">
          <Text style={link}>Sign in</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  )
}
