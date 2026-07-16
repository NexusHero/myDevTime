import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { Card } from '../core/Card'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Weekly Balance check-in (design v10 §Balance) — an OLBI short-form self-report:
 * two items (exhaustion + detachment) on a 1–5 scale, ~10 seconds. Paired with the
 * passive LoadMeter, self-report × work data is the honest signal; neither alone
 * (and never a diagnosis). The answers are **local to the device** by contract — the
 * card says so — so callers persist them with the local-only store, never the server.
 * Once answered (`done`) it collapses to a one-line confirmation; don't ask again this
 * week. Presentational: it owns only the in-progress answer state; the caller owns
 * whether the week is already done.
 */
interface CheckinCardProps {
  /** True when this week is already answered — render the collapsed confirmation. */
  readonly done: boolean
  /** Save this week's self-report (both items are 1–5). Local-only by contract. */
  readonly onSubmit: (answers: { exhaustion: number; detachment: number }) => void
}

/** The two OLBI short-form items, phrased neutrally (a signal, never a diagnosis). */
const ITEMS = [
  { key: 'exhaustion' as const, prompt: 'This week I often felt worn out and tired.' },
  { key: 'detachment' as const, prompt: 'This week I felt distant or disengaged from my work.' },
]
const SCALE = [1, 2, 3, 4, 5]

/** A 1–5 dot scale: "Disagree" → "Agree", the selected step filled in the accent. */
function ScaleRow({
  value,
  onPick,
  labelPrefix,
}: {
  readonly value: number | null
  readonly onPick: (n: number) => void
  readonly labelPrefix: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
        {SCALE.map(n => {
          const on = value === n
          return (
            <Pressable
              key={n}
              onPress={() => onPick(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${labelPrefix}: ${String(n)} of 5`}
              style={{
                flex: 1,
                height: 32,
                borderRadius: t.radius.chip,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: on ? t.color.accent : t.color.border,
                backgroundColor: on ? t.color.accentSoft : t.color.surface,
              }}
            >
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  fontWeight: '600',
                  color: on ? t.color.accent : t.color.ink3,
                }}
              >
                {n}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Disagree</Text>
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Agree</Text>
      </View>
    </View>
  )
}

export function CheckinCard({ done, onSubmit }: CheckinCardProps): React.JSX.Element {
  const t = useTheme()
  const [exhaustion, setExhaustion] = useState<number | null>(null)
  const [detachment, setDetachment] = useState<number | null>(null)
  const ready = exhaustion !== null && detachment !== null

  if (done) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
          <View
            style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: t.color.good }}
          />
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, flex: 1 }}>
            Checked in for this week — thanks. See you next week.
          </Text>
        </View>
      </Card>
    )
  }

  return (
    <Card title="Weekly check-in" subtitle="10 seconds · stays on your device">
      <View style={{ gap: t.spacing.s4 }}>
        {ITEMS.map(item => (
          <View key={item.key} style={{ gap: t.spacing.s2 }}>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{item.prompt}</Text>
            <ScaleRow
              labelPrefix={item.key === 'exhaustion' ? 'Worn out' : 'Disengaged'}
              value={item.key === 'exhaustion' ? exhaustion : detachment}
              onPick={item.key === 'exhaustion' ? setExhaustion : setDetachment}
            />
          </View>
        ))}
        <Pressable
          onPress={() => {
            if (exhaustion !== null && detachment !== null) onSubmit({ exhaustion, detachment })
          }}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityLabel="Save check-in"
          style={{
            alignSelf: 'flex-start',
            paddingVertical: t.spacing.s2,
            paddingHorizontal: t.spacing.s4,
            borderRadius: t.radius.pill,
            backgroundColor: ready ? t.color.accent : t.color.overlay,
            opacity: ready ? 1 : 0.6,
          }}
        >
          <Text
            style={{
              fontSize: t.fontSize.xs,
              fontWeight: '700',
              color: ready ? t.color.accentInk : t.color.ink3,
            }}
          >
            Save check-in
          </Text>
        </Pressable>
      </View>
    </Card>
  )
}
