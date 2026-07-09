import { ScrollView, View } from 'react-native'
import { formatDuration, projectColor, type Screen } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Card, Row } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { findTask } from './projectsData'

/**
 * Task detail (REQ-004, ux-vision §3) — the drill-down from a project's task
 * list: the task's status, its share of tracked time, and the recent entries that
 * make it up, each carrying its provenance (timer / manual / calendar) per the
 * ADR-0005 rule. Entries are illustrative until the tracking API feeds them; the
 * durations render through the design `formatDuration` helper.
 */
interface Entry {
  readonly id: string
  readonly when: string
  readonly durationMs: number
  readonly source: 'timer' | 'manual' | 'calendar'
}

const H = 3_600_000
const M = 60_000

const ENTRIES: readonly Entry[] = [
  { id: 'e1', when: 'Today · 09:30', durationMs: 90 * M, source: 'timer' },
  { id: 'e2', when: 'Yesterday · 14:10', durationMs: 2 * H + 15 * M, source: 'timer' },
  { id: 'e3', when: 'Yesterday · 11:00', durationMs: 45 * M, source: 'calendar' },
  { id: 'e4', when: 'Jul 7 · 16:20', durationMs: 30 * M, source: 'manual' },
]

const SOURCE_LABEL: Record<Entry['source'], string> = {
  timer: 'Timer',
  manual: 'Manual',
  calendar: 'Calendar',
}

export function TaskScreen({
  taskId,
  onNavigate,
}: {
  taskId: string
  onNavigate: (screen: Screen, params?: Record<string, string>) => void
}): React.JSX.Element {
  const t = useTheme()
  const found = findTask(taskId)

  if (!found) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.color.bg }}
        contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
      >
        <SubScreenHeader title="Task" backLabel="Projects" onBack={() => onNavigate('projects')} />
        <Card>
          <Text style={{ color: t.color.ink2 }}>This task could not be found.</Text>
        </Card>
      </ScrollView>
    )
  }

  const { task, project, client } = found
  const color = projectColor(project.id, t.mode)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <SubScreenHeader
        title={task.name}
        subtitle={`${client.name} · ${project.name}`}
        backLabel={project.name}
        onBack={() => onNavigate('project', { projectId: project.id })}
      />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Tracked</Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.lg,
                fontWeight: '700',
                color: t.color.ink,
                marginTop: 2,
              }}
            >
              {formatDuration(task.spentMs)} h
            </Text>
          </View>
          <Badge tone={task.done ? 'good' : 'accent'}>{task.done ? 'Done' : 'In progress'}</Badge>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            marginTop: t.spacing.s4,
            paddingTop: t.spacing.s3,
            borderTopWidth: 1,
            borderTopColor: t.color.border,
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            accessibilityElementsHidden
          />
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{project.name}</Text>
          <Text
            style={{ marginLeft: 'auto', color: t.color.accentText, fontSize: t.fontSize.sm }}
            onPress={() => onNavigate('project', { projectId: project.id })}
          >
            Open project ›
          </Text>
        </View>
      </Card>

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
          Recent entries
        </Text>
        <Card>
          {ENTRIES.map(entry => (
            <Row
              key={entry.id}
              title={formatDuration(entry.durationMs)}
              subtitle={entry.when}
              trailing={
                <Badge tone="neutral" size="sm">
                  {SOURCE_LABEL[entry.source]}
                </Badge>
              }
            />
          ))}
        </Card>
      </View>
    </ScrollView>
  )
}
