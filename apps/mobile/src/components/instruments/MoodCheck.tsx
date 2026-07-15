import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

type Mood = 'good' | 'tense' | 'stressed'

interface MoodCheckProps {
  /** Called after a pick is confirmed (auto-dismiss) or the row is skipped. */
  readonly onDone?: () => void
  readonly onChange?: (mood: Mood) => void
}

const OPTIONS: readonly { readonly id: Mood; readonly label: string }[] = [
  { id: 'good', label: 'Good' },
  { id: 'tense', label: 'Tense' },
  { id: 'stressed', label: 'Stressed' },
]

const CONFIRM_MS = 2000

/**
 * MoodCheck — the momentary strain signal (OLBI/EMA rationale, design system
 * readme). It is **not** a standing widget: it appears only in the punch-out
 * moment as a transient one-tap row (Good / Tense / Stressed), confirms with
 * a quiet acknowledgement, then dismisses itself. The pick is reported via
 * `onChange` for the caller to handle — never modal, never a permanent nag.
 */
export function MoodCheck({ onDone, onChange }: MoodCheckProps): React.JSX.Element {
  const t = useTheme()
  const [picked, setPicked] = useState<Mood | null>(null)

  useEffect(() => {
    if (picked === null) return
    const id = setTimeout(() => onDone?.(), CONFIRM_MS)
    return (): void => {
      clearTimeout(id)
    }
  }, [picked, onDone])

  const tone: Record<Mood, string> = {
    good: t.color.good,
    tense: t.color.warn,
    stressed: t.color.crit,
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: t.spacing.s4,
        paddingVertical: t.spacing.s2,
        paddingHorizontal: t.spacing.s3,
        borderRadius: t.radius.card,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      {picked !== null ? (
        <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.good }}>
          Noted.
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.ink2 }}>
            Clocked out · how was the block?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s4 }}>
            {OPTIONS.map(o => (
              <Pressable
                key={o.id}
                onPress={() => {
                  onChange?.(o.id)
                  setPicked(o.id)
                }}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone[o.id] }}
                />
                <Text
                  style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.ink2 }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => onDone?.()}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            style={{ marginLeft: 'auto' }}
          >
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Skip</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}
