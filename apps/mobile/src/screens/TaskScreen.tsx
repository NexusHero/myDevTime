import { ScrollView, View } from 'react-native'
import { formatDuration, projectColor, type Screen } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Card, Row } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { findTask } from './projectsData'
import { useTaskEntries } from '../hooks/useTaskEntries'
import { entryDurationMs } from '../api/timer'

/**
 * Task detail (REQ-004, ux-vision §3) — the drill-down from a project's task
 * list: the task's status, its share of tracked time, and the recent entries that
 * make it up, each carrying its provenance (timer / manual / calendar) per the
 * ADR-0005 rule. Entries come from the tracking API (`useTaskEntries`) with a demo
 * fallback; durations are computed by the pure `entryDurationMs` and rendered
 * through the design `formatDuration` helper.
 */
const SOURCE_LABEL: Record<string, string> = {
  timer: 'Timer',
  manual: 'Manual',
  calendar: 'Calendar',
}

/** A human label for an entry's provenance, falling back to the raw source. */
function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source
}

/** Compact `YYYY-MM-DD HH:MM` label from an entry's ISO start (no locale drift). */
function whenLabel(startedAt: string): string {
  return startedAt.slice(0, 16).replace('T', ' ')
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
  const entries = useTaskEntries(taskId)
  const now = new Date()

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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            marginBottom: t.spacing.s2,
          }}
        >
          <Text
            style={{
              fontSize: t.fontSize.xs,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.color.ink3,
            }}
          >
            Recent entries
          </Text>
          {!entries.live && (
            <Badge tone="neutral" size="sm">
              Demo data
            </Badge>
          )}
        </View>
        <Card>
          {entries.loading && !entries.data ? (
            <Text style={{ color: t.color.ink2 }}>Loading entries…</Text>
          ) : entries.error ? (
            <Text style={{ color: t.color.crit }}>
              Couldn’t load entries — {entries.error.message}
            </Text>
          ) : (entries.data?.length ?? 0) === 0 ? (
            <Text style={{ color: t.color.ink2 }}>No time entries for this task yet.</Text>
          ) : (
            entries.data?.map(entry => (
              <Row
                key={entry.id}
                title={`${formatDuration(entryDurationMs(entry, now))} h`}
                subtitle={whenLabel(entry.startedAt)}
                trailing={
                  <Badge tone="neutral" size="sm">
                    {sourceLabel(entry.source)}
                  </Badge>
                }
              />
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  )
}
