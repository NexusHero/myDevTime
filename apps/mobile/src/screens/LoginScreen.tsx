import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Text } from '../components/core/Text'
import { Button, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { AuthScaffold } from './auth/AuthScaffold'
import { OrDivider, SocialButtons } from './auth/SocialButtons'
import { type AuthProviders, type Credentials, type SocialProvider } from '../api/auth'

/**
 * Login (REQ-002, ux-vision §4, design v8) — the gate the `AuthGate` shows with no
 * session: the dark brand panel + a warm form. Email + password go through the auth
 * seam (`validateCredentials` catches obvious mistakes before the round-trip); the
 * Google/Apple/GitHub buttons are enabled only where the provider is configured;
 * "Forgot password?" emails a reset link; and a link switches to Register.
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
  const [notice, setNotice] = useState<string | null>(null)

  const loginSchema = z.object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
  })

  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(data => {
    setNotice(null)
    void onSignIn(data).catch(() => {
      /* the session hook surfaces the failure through the `error` prop */
    })
  })

  const forgot = async (): Promise<void> => {
    setNotice(null)
    // Only trigger validation on the email field before sending the reset link
    const isEmailValid = await trigger('email')
    if (!isEmailValid) {
      return
    }
    const email = getValues('email')
    const done = (): void => setNotice('If the email exists, a reset link is on its way.')
    void onForgot(email).then(done).catch(done)
  }

  // Combine remote error with local validation errors (showing only the first error if multiple)
  const firstError = errors.email?.message ?? errors.password?.message
  const message = firstError ?? error?.message ?? null
  const link = { color: t.color.accentText, fontSize: t.fontSize.sm, fontWeight: '600' as const }

  return (
    <AuthScaffold pitch={'Your time.\nTracked, planned, protected.'}>
      <Text
        style={{
          fontSize: t.fontSize.xl,
          fontWeight: '700',
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        Welcome back
      </Text>

      {message !== null && (
        <Text accessibilityRole="alert" style={{ color: t.color.crit, fontSize: t.fontSize.sm }}>
          {message}
        </Text>
      )}
      {notice !== null && (
        <Text style={{ color: t.color.good, fontSize: t.fontSize.sm }}>{notice}</Text>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Email"
            placeholder="you@company.com"
            value={value}
            onChangeText={onChange}
            keyboardType="email-address"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Password"
            placeholder="••••••••"
            value={value}
            onChangeText={onChange}
            secureTextEntry
          />
        )}
      />
      <Pressable onPress={forgot} accessibilityRole="button">
        <Text style={{ ...link, alignSelf: 'flex-end' }}>Forgot password?</Text>
      </Pressable>

      <Button onPress={submit} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>

      <OrDivider />
      <SocialButtons providers={providers} onSocial={onSocial} label={n => n} />

      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: t.spacing.s2 }}
      >
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.sm }}>No account yet?</Text>
        <Pressable onPress={onGoRegister} accessibilityRole="button">
          <Text style={link}>Create free account</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  )
}
