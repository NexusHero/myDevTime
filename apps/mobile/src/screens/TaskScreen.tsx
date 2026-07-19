import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { formatDuration, projectColor, type Screen } from '@mydevtime/design'
import { searchEntriesByNote } from '@mydevtime/domain'
import { Text } from '../components/core/Text'
import { Badge, Card, Input, Row, ScreenListScaffold } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { findTask } from './projectsData'
import { useCatalog } from './useCatalog'
import { useTaskEntries } from '../hooks/useTaskEntries'
import { entryDurationMs } from '../api/timer'
import { TaskEstimateCard } from '../components/task/TaskEstimateCard'
import { TaskAiEstimateCard } from '../components/task/TaskAiEstimateCard'
import { setTaskEstimate } from '../api/tracking'
import { useToast } from '../components/core/Toast'
import { apiBaseUrl } from '../config'

/**
 * Task detail (REQ-004, ux-vision §3) — the drill-down from a project's task
 * list: the task's status, its share of tracked time, and the recent entries that
 * make it up, each carrying its provenance (timer / manual / calendar) per the
 * ADR-0005 rule. The task is looked up in the live catalog (`useCatalog`); entries
 * come from the tracking API (`useTaskEntries`). Durations are computed by the pure
 * `entryDurationMs` and rendered through the design `formatDuration` helper.
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
  const catalog = useCatalog()
  const found = findTask(catalog.data ?? [], taskId)
  const entries = useTaskEntries(taskId)
  const now = new Date()
  const [query, setQuery] = useState('')
  const toast = useToast()
  const [savingEstimate, setSavingEstimate] = useState(false)

  if (!found) {
    const message =
      catalog.loading && catalog.data === null
        ? 'Loading task…'
        : catalog.error
          ? `Couldn’t load the task — ${catalog.error.message}`
          : 'This task could not be found.'
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.color.bg }}
        contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
      >
        <SubScreenHeader title="Task" backLabel="Projects" onBack={() => onNavigate('projects')} />
        <Card>
          <Text style={{ color: catalog.error ? t.color.crit : t.color.ink2 }}>{message}</Text>
        </Card>
      </ScrollView>
    )
  }

  const { task, project, client } = found
  const color = projectColor(project.id, t.mode)

  // Effort estimate (REQ-041): persist the user's category/complexity/estimate via the real task
  // API, then reload the catalog so the card reflects the stored values. No API → honest message.
  const saveEstimate = (patch: {
    category: string | null
    complexity: string | null
    estimateMinutes: number | null
  }): void => {
    if (apiBaseUrl === null) {
      toast.show('Connect an account to save estimates.')
      return
    }
    setSavingEstimate(true)
    setTaskEstimate(apiBaseUrl, task.id, patch)
      .then(() => {
        toast.show('Estimate saved.')
        catalog.reload()
      })
      .catch((e: unknown) =>
        toast.show(e instanceof Error ? e.message : 'Could not save estimate.'),
      )
      .finally(() => setSavingEstimate(false))
  }

  // Apply a reviewed AI estimate (REQ-041): the AI only ever proposed — persisting the number is a
  // deliberate user action through the same deterministic `setTaskEstimate` path (ADR-0005).
  const applyAiEstimate = (estimateMinutes: number): void => {
    if (apiBaseUrl === null) {
      toast.show('Connect an account to save estimates.')
      return
    }
    setSavingEstimate(true)
    setTaskEstimate(apiBaseUrl, task.id, { estimateMinutes })
      .then(() => {
        toast.show('Estimate applied.')
        catalog.reload()
      })
      .catch((e: unknown) =>
        toast.show(e instanceof Error ? e.message : 'Could not apply estimate.'),
      )
      .finally(() => setSavingEstimate(false))
  }

  // The task summary is the fixed list header; the entry history is the virtualized
  // body — it is the one unbounded list here, so only its visible rows mount
  // (ADR-0045 §Perf). Loading/error/empty collapse to the empty slot.
  const rows = entries.loading || entries.error ? [] : (entries.data ?? [])
  // Note search (REQ-036): filter the loaded entries by the deterministic note
  // match — instant and offline, sharing the exact semantics the server's `?q=`
  // uses over the full dataset.
  const visibleRows = searchEntriesByNote(rows, query)
  const searching = query.trim() !== ''
  const emptyNode = (
    <Card>
      {entries.loading && !entries.data ? (
        <Text style={{ color: t.color.ink2 }}>Loading entries…</Text>
      ) : entries.error ? (
        <Text style={{ color: t.color.crit }}>Couldn’t load entries — {entries.error.message}</Text>
      ) : searching && rows.length > 0 ? (
        <Text style={{ color: t.color.ink2 }}>No entries match “{query.trim()}”.</Text>
      ) : (
        <Text style={{ color: t.color.ink2 }}>No time entries for this task yet.</Text>
      )}
    </Card>
  )

  const listHeader = (
    <View style={{ gap: t.spacing.s5 }}>
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

      {/* Effort estimate (REQ-041): deterministic baseline + estimate-vs-actual, persisted real. */}
      <TaskEstimateCard
        category={task.category ?? null}
        complexity={task.complexity ?? null}
        estimateMinutes={task.estimateMinutes ?? null}
        spentMs={task.spentMs}
        busy={savingEstimate}
        onSave={saveEstimate}
      />

      {/* AI estimate review (REQ-041): assist-only proposal over the same category/complexity;
          nothing persists until the user taps Apply, which reuses the deterministic save path. */}
      <TaskAiEstimateCard
        baseUrl={apiBaseUrl}
        category={task.category ?? null}
        complexity={task.complexity ?? null}
        applying={savingEstimate}
        onApply={applyAiEstimate}
      />

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
      </View>

      {rows.length > 0 ? (
        <Input placeholder="Search notes…" value={query} onChangeText={setQuery} />
      ) : null}
    </View>
  )

  return (
    <ScreenListScaffold
      header={
        <SubScreenHeader
          title={task.name}
          subtitle={`${client.name} · ${project.name}`}
          backLabel={project.name}
          onBack={() => onNavigate('project', { projectId: project.id })}
        />
      }
      data={visibleRows}
      keyExtractor={entry => entry.id}
      estimatedItemSize={64}
      listHeader={listHeader}
      listEmpty={emptyNode}
      renderItem={({ item: entry }) => (
        <Row
          title={
            entry.note && entry.note.trim() !== ''
              ? entry.note
              : `${sourceLabel(entry.source)} entry`
          }
          subtitle={`${formatDuration(entryDurationMs(entry, now))} h · ${whenLabel(entry.startedAt)}`}
          trailing={
            <Badge tone="neutral" size="sm">
              {sourceLabel(entry.source)}
            </Badge>
          }
        />
      )}
    />
  )
}
