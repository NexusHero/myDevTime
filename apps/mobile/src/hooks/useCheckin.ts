import { useCallback, useState } from 'react'
import { weekStartIso } from '../insights/insights.js'
import { loadCheckin, saveCheckin, type WeeklyCheckin } from '../insights/checkinStore.js'

export interface CheckinResource {
  /** The current week's stored check-in, or null when this week hasn't been answered. */
  readonly thisWeek: WeeklyCheckin | null
  /** True once the current week is answered — the card collapses to a confirmation. */
  readonly done: boolean
  /** Save this week's self-report locally (never uploaded). */
  readonly submit: (answers: { exhaustion: number; detachment: number }) => void
}

/** Today as `YYYY-MM-DD` in the local timezone. */
function todayIso(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/**
 * The weekly Balance check-in state (design v10 §Balance) — **local-only** by contract:
 * it reads and writes the on-device `checkinStore` and never touches the network, so the
 * OLBI self-report stays on the device as the card promises. "One per week": a stored
 * check-in counts as done only when its `week` matches the current week's Monday, so a
 * new week re-opens the card. Persisting is synchronous (localStorage), so `done` flips
 * immediately on submit.
 */
export function useCheckin(): CheckinResource {
  const week = weekStartIso(todayIso())
  const [stored, setStored] = useState<WeeklyCheckin | null>(() => loadCheckin())
  const thisWeek = stored !== null && stored.week === week ? stored : null

  const submit = useCallback(
    (answers: { exhaustion: number; detachment: number }) => {
      const checkin: WeeklyCheckin = { week, ...answers }
      saveCheckin(checkin)
      setStored(checkin)
    },
    [week],
  )

  return { thisWeek, done: thisWeek !== null, submit }
}
