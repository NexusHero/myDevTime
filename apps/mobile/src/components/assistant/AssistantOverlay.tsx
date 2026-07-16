import { Platform, Pressable, View, useWindowDimensions } from 'react-native'
import { Text } from '../core/Text'
import { Badge, Icon, IconButton } from '../index'
import { AssistantConversation } from './AssistantConversation'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Assistant overlay — the Assistant as a *layer, not a place* (ADR-0063, backlog H3).
 * Opened by the shell's `✦` button or `⌘K`, it floats a right sheet (≤560px) with a
 * scrim over whatever screen you are on, so "ask your data" is reachable everywhere
 * without leaving the calendar. Same grounded, read-only `AssistantConversation` as
 * the full-screen route. Closed by the scrim or the ✕. Renders nothing when closed.
 */
export function AssistantOverlay({
  open,
  onClose,
}: {
  readonly open: boolean
  readonly onClose: () => void
}): React.JSX.Element | null {
  const t = useTheme()
  const { width } = useWindowDimensions()
  if (!open) return null

  const panelWidth = Math.min(560, width - 24)

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 200 }}>
      {/* Scrim: dims the calendar behind, click closes. Blur is web-only chrome. */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close assistant"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(2px)' } : {}),
        }}
      />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          bottom: 12,
          width: panelWidth,
          backgroundColor: t.color.bg,
          borderWidth: 1,
          borderColor: t.color.border,
          borderRadius: 16,
          overflow: 'hidden',
          elevation: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s3,
            paddingHorizontal: t.spacing.s5,
            paddingVertical: t.spacing.s4,
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="assistant" size={18} color={t.color.accentInk} />
          </View>
          <Text
            style={{
              flex: 1,
              fontWeight: '700',
              fontSize: t.fontSize.lg,
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
            }}
          >
            Assistant
          </Text>
          <Badge tone="neutral">Your data · read-only</Badge>
          <IconButton
            icon={<Icon name="x" size={18} />}
            label="Close assistant"
            onPress={onClose}
          />
        </View>

        <AssistantConversation />
      </View>
    </View>
  )
}
