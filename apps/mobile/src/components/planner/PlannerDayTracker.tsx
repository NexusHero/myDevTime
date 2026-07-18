import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { projectColor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { useTimerContext } from '../../timer/TimerContext'
import { useWorktime } from '../../hooks/useWorktime'
import { useToast } from '../core/Toast'
import { findProject, type Client } from '../../screens/projectsData'

/**
 * The Planner **Day tracker row** (design v20 `PlannerDay` tracker): a single bar above the day
 * canvas that starts the shared timer on a chosen project + optional task, pauses/resumes it,
 * and drives the punch clock — all through the same seams the Island and Today hero use, so there
 * is never a second clock (ux-vision §2.3, ADR-0005). Every control is client-side over
 * already-loaded state (the live catalog, the timer, the punch clock); it books nothing on its
 * own beyond a real running entry. Start/stop/clock actions land a confirmation toast (v20).
 *
 * The button row is fixed — states disable buttons rather than swapping them — so nothing reflows
 * when the timer starts, pauses or the shift clocks in/out. English copy (UI is English-only).
 */
export interface PlannerDayTrackerProps {
  /** The live tracking catalog (clients → projects → tasks) the picker chooses from. */
  readonly clients: readonly Client[]
}

export function PlannerDayTracker({ clients }: PlannerDayTrackerProps): React.JSX.Element {
  const t = useTheme()
  const timer = useTimerContext()
  const worktime = useWorktime()
  const toast = useToast()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

  const projects = useMemo(
    () => clients.flatMap(c => c.projects.map(p => ({ id: p.id, name: p.name }))),
    [clients],
  )
  const tasks = useMemo(
    () => (projectId !== null ? (findProject(clients, projectId)?.project.tasks ?? []) : []),
    [clients, projectId],
  )

  const running = timer.running !== null
  const paused = timer.paused
  const live = running && !paused
  const punchedIn = worktime.running !== null

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
    const tracked = timer.elapsed
    timer.punchOut()
    toast.show(`Timer stopped — ${tracked} tracked.`)
  }
  const toggleTimer = (): void => {
    if (running || paused) stop()
    else start()
  }
  const togglePause = (): void => {
    if (paused) {
      timer.resume()
      toast.show('Timer resumed.')
    } else {
      timer.pause()
      toast.show('Timer paused.')
    }
  }
  const togglePunch = (): void => {
    if (punchedIn) {
      worktime.clockOut()
      toast.show('Clocked out.')
    } else {
      worktime.clockIn()
      toast.show('Clocked in.')
    }
  }

  const idle = !running && !paused

  return (
    <View
      style={{
        gap: t.spacing.s2,
        paddingHorizontal: t.spacing.s3,
        paddingVertical: t.spacing.s3,
        borderRadius: t.radius.block,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        {/* Live dot — lit while a segment runs, dim when idle or paused. */}
        <View
          accessibilityElementsHidden
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: live ? t.color.live : t.color.ink3,
          }}
        />

        {/* Selection area — the picker when idle, the running work when active. */}
        <View style={{ flex: 1, minWidth: 120 }}>
          {idle ? (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }} numberOfLines={1}>
              {projects.length === 0
                ? 'No projects yet — add one in Projects to start a tracked timer.'
                : 'Pick a project below, then Start.'}
            </Text>
          ) : (
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }} numberOfLines={1}>
              {paused
                ? 'Timer paused'
                : runningName != null
                  ? `Tracking · ${runningName}`
                  : 'Tracking'}
            </Text>
          )}
        </View>

        {/* Elapsed — mono, dim when idle. */}
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.md,
            color: idle ? t.color.ink3 : t.color.ink,
          }}
        >
          {timer.elapsed}
        </Text>

        {/* Fixed button pair — states disable, never swap, so nothing reflows. */}
        <Button size="sm" disabled={timer.busy} onPress={toggleTimer}>
          {running || paused ? 'Stop' : 'Start'}
        </Button>
        <Button size="sm" variant="ghost" disabled={idle || timer.busy} onPress={togglePause}>
          {paused ? 'Resume' : 'Pause'}
        </Button>

        {/* Punch clock — far right. */}
        <Button
          size="sm"
          variant={punchedIn ? 'ghost' : 'primary'}
          disabled={worktime.busy}
          onPress={togglePunch}
        >
          {punchedIn ? 'Clock out' : 'Clock in'}
        </Button>
      </View>

      {/* Project + task pickers — only while idle (running shows the static work above). */}
      {idle && projects.length > 0 && (
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
                  setTaskId(null)
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

      {idle && tasks.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.s2, alignItems: 'center' }}
        >
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Task · optional</Text>
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
                  style={{ fontSize: t.fontSize.xs, color: on ? t.color.accent : t.color.ink2 }}
                >
                  {task.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}
