import { useState } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { Text } from '../components/core/Text'
import { projectColor } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, Button, Card, DayBlock, Island } from '../components/index'
import { useTimer } from '../hooks/useTimer'
import { NlQuickAdd } from './NlQuickAdd'

/**
 * Today — the Day Canvas home (ux-vision §2.1, §3): the morning briefing with the
 * plan (ghost blocks) and actuals on one surface, a drift indicator, and the
 * Island carrying live timer/punch state. Ported from the design system's
 * `TodayScreen`; project colors are assigned deterministically per id (ADR-0005).
 */
interface Ghost {
  readonly id: string
  readonly label: string
  readonly time: string
  readonly project: string
}

const INITIAL_GHOSTS: readonly Ghost[] = [
  { id: 'g1', label: 'Deep work: Sync engine', time: '13:00–15:00', project: 'sync-engine' },
  { id: 'g2', label: 'Code review backlog', time: '15:15–16:00', project: 'reviews' },
]

export function TodayScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const [ghosts, setGhosts] = useState<readonly Ghost[]>(INITIAL_GHOSTS)
  const [expanded, setExpanded] = useState(false)
  const timer = useTimer()
  const isRunning = timer.running !== null

  const dismiss = (id: string): void => setGhosts(gs => gs.filter(g => g.id !== id))

  const briefing = (
    <Card
      title="Morning briefing"
      subtitle="08:12"
      action={
        ghosts.length > 0 ? (
          <Button size="sm" variant="ghost" onPress={() => setGhosts([])}>
            Accept all
          </Button>
        ) : undefined
      }
    >
      <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginBottom: t.spacing.s3 }}>
        3 meetings, 4,5h Fokus möglich. Vorschlag unten — pass an oder verwerfe einzeln.
      </Text>
      <View style={{ gap: t.spacing.s2 }}>
        <DayBlock
          label="Team standup"
          time="09:00–09:15"
          kind="meeting"
          color={projectColor('finanzo', t.mode)}
          height={48}
        />
        <DayBlock
          label="Finanzo Review"
          time="09:30–11:00"
          kind="actual"
          color={projectColor('finanzo', t.mode)}
          height={56}
        />
        <DayBlock
          label="Client call — Nordwind"
          time="11:15–12:00"
          kind="meeting"
          color={projectColor('nordwind', t.mode)}
          height={48}
        />
        {ghosts.map(g => (
          <DayBlock
            key={g.id}
            label={g.label}
            time={g.time}
            kind="ghost"
            color={projectColor(g.project, t.mode)}
            onAccept={() => dismiss(g.id)}
            onDismiss={() => dismiss(g.id)}
          />
        ))}
      </View>
    </Card>
  )

  const aside = (
    <View style={{ gap: t.spacing.s4, ...(stacked ? null : { width: 260 }) }}>
      <Card title="Drift">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Badge tone="good">On track</Badge>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>+6m vs. plan</Text>
        </View>
      </Card>
    </View>
  )

  const floatingIsland = (
    <View
      style={{
        position: 'absolute',
        bottom: t.spacing.s5,
        alignSelf: 'center',
        pointerEvents: 'box-none',
      }}
    >
      <Island
        running={isRunning}
        elapsed={timer.elapsed}
        // `punched` (attendance clock-in) tracks the timer for now; a dedicated
        // punch-clock lands with the work-time slice (REQ-010).
        punched={isRunning}
        expanded={expanded}
        onToggle={() => setExpanded(e => !e)}
        actions={[
          isRunning
            ? { label: timer.busy ? '…' : 'Stop', onPress: timer.punchOut }
            : { label: timer.busy ? '…' : 'Start', onPress: () => timer.punchIn() },
        ]}
      />
    </View>
  )

  const SCROLL_BOTTOM_CLEARANCE = 120 // Space for the floating Island

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingBottom: SCROLL_BOTTOM_CLEARANCE,
          gap: t.spacing.s5,
        }}
      >
        <View>
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize.xl,
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
            }}
          >
            Today
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
            Tuesday, July 8
          </Text>
        </View>
        <NlQuickAdd />
        <View
          style={{
            flexDirection: stacked ? 'column' : 'row',
            gap: t.spacing.s5,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ alignSelf: 'stretch', ...(stacked ? null : { flex: 1 }) }}>
            {briefing}
          </View>
          {aside}
        </View>
      </ScrollView>
      {floatingIsland}
    </View>
  )
}
