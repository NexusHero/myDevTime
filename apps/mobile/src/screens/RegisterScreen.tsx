import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Text } from '../components/core/Text'
import { Button, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { AuthScaffold } from './auth/AuthScaffold'
import { OrDivider, SocialButtons } from './auth/SocialButtons'
import { type AuthProviders, type SignUpInput, type SocialProvider } from '../api/auth'

/**
 * Register (REQ-002, design v8) — create an account: social sign-up first (only the
 * configured providers are enabled), then name + email + password through the auth
 * seam. On success the `AuthGate` swaps to the app; if the server requires email
 * verification first, a calm notice tells the user to check their inbox. A link
 * switches back to Login.
 */
function passwordHint(pw: string): string {
  if (!pw || pw.length === 0) return 'At least 8 characters — numbers or symbols make it stronger.'
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
  const [verifyNotice, setVerifyNotice] = useState(false)

  const registerSchema = z.object({
    name: z.string().min(1, 'Enter your name.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
  })

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  // Watch the password field for the dynamic hint
  const currentPassword = useWatch({ control, name: 'password' })

  const submit = handleSubmit(data => {
    setVerifyNotice(false)
    void onSignUp(data)
      .then(signedIn => {
        // signedIn === true → AuthGate swaps to the app; false → verify email first.
        if (!signedIn) setVerifyNotice(true)
      })
      .catch(() => {
        /* surfaced via the `error` prop */
      })
  })

  const firstError = errors.name?.message ?? errors.email?.message ?? errors.password?.message
  const message = firstError ?? error?.message ?? null
  const link = { color: t.color.accentText, fontSize: t.fontSize.sm, fontWeight: '600' as const }

  if (verifyNotice) {
    // We can use getValues('email') to show the email, but since it's just a success screen,
    // we could also just say "your email" if we don't extract it.
    // To be precise we can extract it before submit.
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
          We’ve sent a confirmation email to your address. Confirm it, then you can sign in.
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

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input label="Name" placeholder="Suhay Sevinc" value={value} onChangeText={onChange} />
        )}
      />

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

      <View style={{ gap: 4 }}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              placeholder="At least 8 characters"
              value={value}
              onChangeText={onChange}
              secureTextEntry
            />
          )}
        />
        <Text
          style={{
            fontSize: t.fontSize.xs,
            color: currentPassword.length >= 8 ? t.color.good : t.color.ink3,
          }}
        >
          {passwordHint(currentPassword)}
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
