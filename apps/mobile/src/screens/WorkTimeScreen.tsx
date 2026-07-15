import { View } from 'react-native'
import { Text } from '../components/core/Text'
import { formatDuration } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, Button, Card, ScreenScaffold } from '../components/index'
import { SubScreenHeader } from './SubScreenHeader'
import { useWorktime } from '../hooks/useWorktime'
import type { Shift } from '../api/worktime'

/**
 * Work time — the punch clock (REQ-028, ADR-0010): clock in/out, the running
 * shift's elapsed time, this week's shifts with their ArbZG §4 break-rule warnings,
 * and the overtime balance. Every number is fed by the `worktime` module
 * (`useWorktime`); the break shortfall and overtime balance are the deterministic
 * core's (ADR-0005), so the view only formats and never computes them. With no
 * backend the screen is empty; clock-in/out still work locally so it stays usable.
 */
function grossMs(shift: Shift): number {
  if (shift.endedAt === null) return 0
  return Math.max(0, Date.parse(shift.endedAt) - Date.parse(shift.startedAt))
}

function ShiftRow({ shift }: { shift: Shift }): React.JSX.Element {
  const t = useTheme()
  const short = shift.breakShortfallMs > 0
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s2,
      }}
    >
      <Text style={{ width: 96, fontSize: t.fontSize.sm, color: t.color.ink }}>
        {shift.startedAt.slice(0, 10)}
      </Text>
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize.sm,
          color: t.color.ink,
          minWidth: 56,
        }}
      >
        {formatDuration(grossMs(shift))} h
      </Text>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, flex: 1 }}>
        {formatDuration(shift.breakMs)} break
      </Text>
      {short && (
        <Badge tone="warn">{`Break short ${formatDuration(shift.breakShortfallMs)}`}</Badge>
      )}
    </View>
  )
}

export function WorkTimeScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const wt = useWorktime()
  const clockedIn = wt.running !== null

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s2 }}>
      <View style={{ flex: 1 }}>
        <SubScreenHeader title="Work time" subtitle="Clock in, breaks & overtime" onBack={onBack} />
      </View>
    </View>
  )

  return (
    <ScreenScaffold header={header}>
      {/* Punch clock */}
      <Card>
        <View style={{ alignItems: 'center', gap: t.spacing.s3 }}>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {clockedIn ? 'Clocked in' : 'Not clocked in'}
          </Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xl,
              fontWeight: '700',
              color: clockedIn ? t.color.ink : t.color.ink3,
            }}
          >
            {wt.elapsed}
          </Text>
          <Button
            variant={clockedIn ? 'danger' : 'primary'}
            disabled={wt.busy}
            onPress={clockedIn ? wt.clockOut : wt.clockIn}
          >
            {clockedIn ? 'Clock out' : 'Clock in'}
          </Button>
        </View>
      </Card>

      {/* Overtime balance */}
      <Card>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
            Overtime balance (7 days)
          </Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.lg,
              fontWeight: '700',
              color: wt.overtimeMs >= 0 ? t.color.good : t.color.crit,
            }}
          >
            {formatDuration(wt.overtimeMs)} h
          </Text>
        </View>
      </Card>

      {/* This week's shifts */}
      <View>
        <Text
          style={{
            fontSize: t.fontSize.xs,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: t.color.ink3,
            marginBottom: t.spacing.s2,
          }}
        >
          This week
        </Text>
        <Card>
          {wt.loading && wt.shifts.length === 0 ? (
            <Text style={{ color: t.color.ink2 }}>Loading…</Text>
          ) : wt.error ? (
            <Text style={{ color: t.color.crit }}>Couldn’t load shifts — {wt.error.message}</Text>
          ) : wt.shifts.length === 0 ? (
            <Text style={{ color: t.color.ink2 }}>No shifts this week yet.</Text>
          ) : (
            <View>
              {wt.shifts.map(s => (
                <ShiftRow key={s.id} shift={s} />
              ))}
              <Text
                style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginTop: t.spacing.s2 }}
              >
                Break warnings use the ArbZG §4 preset — a hint, not legal advice.
              </Text>
            </View>
          )}
        </Card>
      </View>
    </ScreenScaffold>
  )
}
