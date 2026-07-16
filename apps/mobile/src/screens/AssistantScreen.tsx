import { View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Icon } from '../components/index'
import { AssistantConversation } from '../components/assistant/AssistantConversation'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Assistant (full-screen route) — the grounded, read-only helper (ux-vision §2.4,
 * #20, M2) as a routed deep-link target. The calendar-centric IA (ADR-0063) makes
 * the shell overlay the primary way in (`✦` / `⌘K`); this route stays for deep links
 * and the Profile hub. Both render the same `AssistantConversation`.
 */
export function AssistantScreen(): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s3,
          gap: t.spacing.s3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3, flex: 1 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="assistant" size={20} color="#fff" />
          </View>
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize['2xl'],
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
              letterSpacing: t.fontSize['2xl'] * t.letterSpacing.tight,
            }}
          >
            Assistant
          </Text>
        </View>
        <Badge tone="neutral">Your data · read-only</Badge>
      </View>

      <AssistantConversation />
    </View>
  )
}
