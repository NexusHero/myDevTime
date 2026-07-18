import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { projectColor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { useTimerContext } from '../../timer/TimerContext'
import { useToast } from '../core/Toast'
import { findProject, type Client } from '../../screens/projectsData'

/**
 * The Planner **in-bar start-picker** (design v20 day-tracker row): pick a project and an
 * optional task, hit Start, and the shared live timer begins on that work — the same seam the
 * Island and the Today hero drive, so there is never a second clock (ux-vision §2.3). Starting
 * and stopping land a transient confirmation toast (design v20 `dtToast`). It books nothing on
 * its own beyond a real running entry (ADR-0005): the projects come live from the tracking
 * catalog, never a mock. While a timer runs it collapses to a slim status line with Stop, so it
 * mirrors the mock's tracker row without duplicating the Island's full control set.
 */
export interface PlannerStartPickerProps {
  /** The live tracking catalog (clients → projects → tasks) the picker chooses from. */
  readonly clients: readonly Client[]
}

interface PickProject {
  readonly id: string
  readonly name: string
}

export function PlannerStartPicker({ clients }: PlannerStartPickerProps): React.JSX.Element {
  const t = useTheme()
  const timer = useTimerContext()
  const toast = useToast()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

  const projects = useMemo<readonly PickProject[]>(
    () => clients.flatMap(c => c.projects.map(p => ({ id: p.id, name: p.name }))),
    [clients],
  )
  const tasks = useMemo(
    () => (projectId !== null ? (findProject(clients, projectId)?.project.tasks ?? []) : []),
    [clients, projectId],
  )

  const active = timer.running !== null || timer.paused

  // While a timer runs, name the project it runs on (resolved from the live catalog) so the
  // status line reads truthfully — never a fabricated label.
  const runningName =
    timer.running?.projectId != null
      ? (findProject(clients, timer.running.projectId)?.project.name ?? null)
      : null

  const start = (): void => {
    const chosen = projectId !== null ? projects.find(p => p.id === projectId) : undefined
    timer.punchIn({
      ...(projectId !== null ? { projectId } : {}),
      ...(taskId !== null ? { taskId } : {}),
    })
    toast.show(chosen ? `Timer running on ${chosen.name}.` : 'Timer running.')
  }
  const stop = (): void => {
    const tracked = timer.elapsed // snapshot before the optimistic clear
    timer.punchOut()
    toast.show(`Timer stopped — ${tracked} tracked.`)
  }

  if (active) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s3,
          paddingHorizontal: t.spacing.s3,
          paddingVertical: t.spacing.s2,
          borderRadius: t.radius.block,
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: t.color.border,
        }}
      >
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.live }}
          accessibilityElementsHidden
        />
        <Text style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.ink }} numberOfLines={1}>
          {timer.paused
            ? 'Timer paused'
            : runningName != null
              ? `Timer running on ${runningName}`
              : 'Timer running'}
        </Text>
        <Button size="sm" variant="ghost" disabled={timer.busy} onPress={stop}>
          Stop
        </Button>
      </View>
    )
  }

  return (
    <View
      style={{
        gap: t.spacing.s2,
        paddingHorizontal: t.spacing.s3,
        paddingVertical: t.spacing.s2,
        borderRadius: t.radius.block,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      {projects.length === 0 ? (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
          No projects yet — add one in Projects to start a tracked timer.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.s2, alignItems: 'center' }}
        >
          {projects.map(p => {
            const on = p.id === projectId
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={p.name}
                onPress={() => {
                  setProjectId(on ? null : p.id)
                  setTaskId(null) // a new project clears the task choice
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: t.spacing.s3,
                  paddingVertical: 6,
                  borderRadius: t.radius.pill,
                  backgroundColor: on ? t.color.accentSoft : t.color.sunk,
                  borderWidth: 1,
                  borderColor: on ? t.color.accent : t.color.border,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: projectColor(p.id, t.mode),
                  }}
                />
                <Text
                  style={{
                    fontSize: t.fontSize.xs,
                    fontWeight: '600',
                    color: on ? t.color.accent : t.color.ink,
                  }}
                >
                  {p.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      {tasks.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.s2, alignItems: 'center' }}
        >
          {tasks.map(task => {
            const on = task.id === taskId
            return (
              <Pressable
                key={task.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={task.name}
                onPress={() => setTaskId(on ? null : task.id)}
                style={{
                  paddingHorizontal: t.spacing.s2,
                  paddingVertical: 4,
                  borderRadius: t.radius.chip,
                  backgroundColor: on ? t.color.accentSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? t.color.accent : t.color.border,
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSize.xs,
                    color: on ? t.color.accent : t.color.ink2,
                  }}
                >
                  {task.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button size="sm" disabled={timer.busy} onPress={start}>
          Start timer
        </Button>
      </View>
    </View>
  )
}
