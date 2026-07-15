import { View } from 'react-native'
import { Text } from '../../components/core/Text'
import { Button } from '../../components/index'
import { useTheme } from '../../theme/ThemeProvider'
import type { AuthProviders, SocialProvider } from '../../api/auth'

const ALL: readonly SocialProvider[] = ['google', 'apple', 'github']
const NAME: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple', github: 'GitHub' }

/**
 * The Google / Apple / GitHub buttons (design v8 auth). A provider is only tappable
 * when this deployment has its OAuth secrets configured (`providers.social`);
 * otherwise it is disabled — honest, never a button that errors on tap. When none
 * is configured a short note explains why, and email/password still works.
 */
export function SocialButtons({
  providers,
  onSocial,
  label,
}: {
  readonly providers: AuthProviders
  readonly onSocial: (provider: SocialProvider) => void
  /** How to label a provider, e.g. `n => n` (login) or `n => `Mit ${n} …`` (register). */
  readonly label: (name: string) => string
}): React.JSX.Element {
  const t = useTheme()
  const none = providers.social.length === 0
  return (
    <View style={{ gap: t.spacing.s2 }}>
      {ALL.map(p => {
        const enabled = providers.social.includes(p)
        return (
          <Button key={p} variant="secondary" disabled={!enabled} onPress={() => onSocial(p)}>
            {label(NAME[p])}
          </Button>
        )
      })}
      {none && (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, textAlign: 'center' }}>
          Social-Login ist für diese Instanz noch nicht konfiguriert — nutze E-Mail.
        </Text>
      )}
    </View>
  )
}

/** A labelled "oder" divider between social and email. */
export function OrDivider(): React.JSX.Element {
  const t = useTheme()
  const line = { flex: 1, height: 1, backgroundColor: t.color.border }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
      <View style={line} />
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>oder</Text>
      <View style={line} />
    </View>
  )
}
