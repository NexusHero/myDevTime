import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { useTheme } from '../../theme/ThemeProvider'
import { Text } from '../core/Text'
import { Button, Card } from '../index'
import type { TodayShutdown } from '../../today/shutdown'

/**
 * ShutdownCard — the Feierabend ritual (issue #362), lifted verbatim from
 * [`TodayScreen`](../../screens/TodayScreen.tsx). It is a controlled view over the pure
 * [`todayShutdown`](../../today/shutdown.ts) view-model: it renders nothing when the day
 * is idle (nothing tracked or booked) or already closed, and shows the Booked / Tracked
 * reality / Still open figures + the `git commit -m "Feierabend"` button otherwise.
 *
 * The deterministic core ([`todayShutdown`](../../today/shutdown.ts)) owns every figure
 * (ADR-0005); this only renders its output. Closing the day is local to the host session
 * (no fabricated backend state) — the `onClose` callback is the ritual gesture.
 */
export interface ShutdownCardProps {
  /** The pure day-close view-model (booked/tracked/unbooked figures + state). */
  readonly shutdown: TodayShutdown
  /** Whether the host has already closed the day (hides the card). */
  readonly closed: boolean
  /** Close the day — the `git commit -m "Feierabend"` gesture (local state only). */
  readonly onClose: () => void
}

export function ShutdownCard({
  shutdown,
  closed,
  onClose,
}: ShutdownCardProps): React.JSX.Element | null {
  const t = useTheme()
  if (closed || shutdown.state === 'idle') return null
  return (
    <Card title="Close the day" subtitle="Feierabend">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s5 }}>
        <View>
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Booked</Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.lg,
              fontWeight: '600',
              color: t.color.ink,
            }}
          >
            {`${formatDuration(shutdown.summary.bookedMs)} h`}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Tracked reality</Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.lg,
              fontWeight: '600',
              color: t.color.ink,
            }}
          >
            {`${formatDuration(shutdown.summary.trackedMs)} h`}
          </Text>
        </View>
        {shutdown.summary.unbookedMs > 0 && (
          <View>
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Still open</Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.lg,
                fontWeight: '600',
                color: t.color.live,
              }}
            >
              {`${formatDuration(shutdown.summary.unbookedMs)} h`}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          fontSize: t.fontSize.xs,
          color: t.color.ink2,
          lineHeight: 18,
          marginTop: t.spacing.s3,
        }}
      >
        {shutdown.state === 'clean'
          ? 'Everything you tracked is booked — the day is fully accounted for. Feierabend.'
          : shutdown.summary.openDraftCount > 0
            ? `${String(shutdown.summary.openDraftCount)} draft${shutdown.summary.openDraftCount === 1 ? '' : 's'} to book (${formatDuration(shutdown.recoveredMs)} h of tracked reality). Open the Planner to review and book them — nothing is booked for you.`
            : 'Some tracked reality is still unbooked. Open the Planner to book it before you close the day.'}
      </Text>
      {shutdown.summary.tomorrowFirst !== null && (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginTop: t.spacing.s2 }}>
          {`Tomorrow starts with ${shutdown.summary.tomorrowFirst}.`}
        </Text>
      )}
      <View style={{ flexDirection: 'row', marginTop: t.spacing.s4 }}>
        <Button size="sm" onPress={onClose}>
          {'git commit -m "Feierabend"'}
        </Button>
      </View>
    </Card>
  )
}
