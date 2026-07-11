import { Pressable, View, type ViewStyle } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * DayBlock (canvas) — one block on the Day Canvas.
 * Actual: solid fill with project color (reality).
 * Ghost: dashed border (Co-Planner proposal), with accept/dismiss buttons.
 * Meeting: raised surface with colored left border (calendar event).
 * Padding: s3 (12pt), Radius: block (10pt).
 */
type Kind = 'actual' | 'ghost' | 'meeting'

interface DayBlockProps {
  readonly label: string
  readonly time: string
  readonly kind?: Kind
  /** Project color (deterministic per project id — see `@mydevtime/design`). */
  readonly color: string
  readonly height?: number
  readonly onAccept?: () => void
  readonly onDismiss?: () => void
}

export function DayBlock({
  label,
  time,
  kind = 'actual',
  color,
  height = 64,
  onAccept,
  onDismiss,
}: DayBlockProps): React.JSX.Element {
  const t = useTheme()
  const isGhost = kind === 'ghost'
  const isMeeting = kind === 'meeting'

  const base: ViewStyle = {
    height,
    borderRadius: t.radius.block,
    paddingVertical: t.spacing.s2,
    paddingHorizontal: t.spacing.s3,
    justifyContent: 'center',
    gap: 2,
  }

  const container: ViewStyle = isGhost
    ? {
        ...base,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: color,
        opacity: 0.9,
      }
    : isMeeting
      ? {
          ...base,
          backgroundColor: t.color.raised,
          borderWidth: 1,
          borderColor: t.color.borderStrong,
          borderLeftWidth: 3,
          borderLeftColor: color,
        }
      : { ...base, backgroundColor: color }

  const labelColor = isGhost ? color : isMeeting ? t.color.ink : '#ffffff'
  const timeColor = isGhost ? color : isMeeting ? t.color.ink2 : 'rgba(255,255,255,0.85)'

  return (
    <View
      style={container}
      accessibilityRole={isGhost ? 'button' : 'text'}
      accessibilityLabel={`${isGhost ? 'Vorschlag: ' : ''}${label}, ${time}`}
    >
      <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: labelColor }}>{label}</Text>
      <Text style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.xs, color: timeColor }}>
        {time}
      </Text>
      {isGhost && (
        <View style={{ position: 'absolute', top: 6, right: 8, flexDirection: 'row', gap: 4 }}>
          <Pressable
            onPress={() => onAccept?.()}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${label}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 12 }}>✓</Text>
          </Pressable>
          <Pressable
            onPress={() => onDismiss?.()}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${label}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color, fontSize: 12 }}>✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
