import { ScrollView, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

export interface OverflowItem {
  readonly label: string
  /** Optional trailing detail (a duration, a count) rendered in the numeric face. */
  readonly detail?: string
  /** Optional leading dot color (a project color); defaults to the warn tone. */
  readonly color?: string
}

interface OverflowShelfProps {
  readonly items: readonly OverflowItem[]
}

/**
 * The "ohne Platz" chip shelf (design v1, bounded screens) — overbooked/unplaced
 * work that did not fit the day becomes a **horizontal, dashed chip rail**, not a
 * growing vertical list. It scrolls sideways so the screen's height stays bounded
 * no matter how much spilled over. Renders nothing when there is nothing spilled.
 */
export function OverflowShelf({ items }: OverflowShelfProps): React.JSX.Element | null {
  const t = useTheme()
  if (items.length === 0) return null
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon />
        <Text
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '800',
            letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
            textTransform: 'uppercase',
            color: t.color.warn,
          }}
        >
          Ohne Platz
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.spacing.s2, paddingRight: t.spacing.s2 }}
      >
        {items.map((item, i) => (
          <View
            key={`${item.label}-${String(i)}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              paddingVertical: 7,
              paddingHorizontal: t.spacing.s3,
              borderRadius: t.radius.pill,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: t.color.borderStrong,
              backgroundColor: t.color.surface,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.color ?? t.color.warn,
              }}
            />
            <Text
              style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.detail !== undefined && (
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink3,
                }}
              >
                {item.detail}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

/** The alert glyph rendered as a small warn-toned triangle (no icon dep). */
function Icon(): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 11,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: t.color.warn,
      }}
    />
  )
}
