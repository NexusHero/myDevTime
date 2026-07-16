import { useEffect, useState } from 'react'
import { useWorktime } from './useWorktime.js'
import { useTimerContext } from '../timer/TimerContext.js'
import { shouldRemindToTrack } from '../reminder/reminder.js'

/**
 * The Smart Reminder resource (design v10 §D12): tells the Today screen when to nudge
 * "you're clocked in but not tracking". Composes the live work-time shift + timer
 * state and runs the deterministic `shouldRemindToTrack`; a slow tick re-evaluates as
 * the shift ages. Dismissal is keyed to the current shift, so a fresh shift re-arms it
 * and the nudge never nags again within the same one.
 */
export interface TrackReminderResource {
  readonly show: boolean
  readonly dismiss: () => void
}

/** How often to re-check the elapsed time while clocked in (cheap, no network). */
const TICK_MS = 30_000

export function useTrackReminder(): TrackReminderResource {
  const worktime = useWorktime()
  const timer = useTimerContext()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [dismissedShift, setDismissedShift] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  const shift = worktime.running
  const show = shouldRemindToTrack({
    punchedIn: shift !== null,
    timerActive: timer.running !== null || timer.paused,
    clockedInSinceMs: shift === null ? null : Date.parse(shift.startedAt),
    nowMs,
    dismissed: shift !== null && dismissedShift === shift.startedAt,
  })

  const dismiss = (): void => {
    if (shift !== null) setDismissedShift(shift.startedAt)
  }

  return { show, dismiss }
}
