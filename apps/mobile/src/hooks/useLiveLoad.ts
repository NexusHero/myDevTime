import { useEffect, useMemo, useState } from 'react'
import {
  computeBaseline,
  evaluateLiveLoad,
  HEAVY_LOAD_SCORE,
  MIN_BASELINE_DAYS,
  type LiveLoad,
  type LiveLoadInput,
} from '@mydevtime/domain'
import { apiBaseUrl } from '../config.js'
import { getLoadHistory, type LoadHistoryDay } from '../api/loadHistory.js'
import { useWorktime } from './useWorktime.js'
import type { Shift } from '../api/worktime.js'

/**
 * The intraday live-load resource (ADR-0071 P1, REQ-067): feeds the deterministic
 * `evaluateLiveLoad` core from the client's *real* state — the punch clock's shifts
 * (`useWorktime`) and the caller's own load-score history (`getLoadHistory` →
 * `computeBaseline`, the H3 baseline principle). The derivation itself is the pure,
 * exported `liveLoadInputFrom` (unit-tested without rendering); the hook only adds
 * the one-shot history fetch and a slow 30 s tick (mirroring `useTrackReminder`) so
 * the level keeps up with a running shift. Every signal this file cannot know is
 * honest about it — 0 or a wide-open band, never a guess (ADR-0005).
 */
export interface LiveLoadResource {
  readonly load: LiveLoad
  /** True until the worktime feed and the baseline history have both answered. */
  readonly loading: boolean
}

/** The client-side state the derivation reads — all of it real, none of it fetched here. */
export interface LiveLoadSources {
  readonly now: number
  readonly running: Shift | null
  readonly shifts: readonly Shift[]
  /** Load-score history oldest→newest, or `null` while loading / unavailable. */
  readonly history: readonly LoadHistoryDay[] | null
}

/** The device-local calendar day an instant falls on (the same keying the nudge budget uses). */
function localDayKey(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`
}

/** A completed shift's on-the-clock time net of its recorded breaks, floored at 0. */
function netShiftMs(startedAt: string, endedAt: string, breakMs: number): number {
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt) - breakMs)
}

/**
 * The current run of heavy days ending yesterday, straight off the history tail.
 * `computeBaseline`'s `consecutive-heavy-days` flag reports the *longest* run
 * anywhere in the window; `LiveLoadInput` asks for the run *ending yesterday*, so
 * this walks back from the newest entry instead — and mirrors the baseline's
 * honesty rule: below `MIN_BASELINE_DAYS` of history there is no verdict at all.
 * Exported: `useLifeCare`'s rest-day voice needs the same "run ending NOW" notion
 * (an old streak the person already recovered from must not fire a rest day today).
 */
export function trailingHeavyRun(history: readonly LoadHistoryDay[]): number {
  if (history.length < MIN_BASELINE_DAYS) return 0
  let run = 0
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const day = history[i]
    if (day === undefined || day.loadScore < HEAVY_LOAD_SCORE) break
    run += 1
  }
  return run
}

/**
 * Derive the domain `LiveLoadInput` from real client state. Pure — exported for
 * unit tests. The honest mapping, signal by signal:
 * - `workedMsToday`: net duration (minus recorded breaks) of every completed shift
 *   attributed to the local day it **ended** (a cross-midnight shift lands on the
 *   day you clock out — the punch-clock convention), plus the running shift's
 *   elapsed time net of its breaks.
 * - `focusMsSinceBreak`: approximated as the running shift's unbroken-equivalent
 *   time, `now − startedAt − breakMs` (the client has no per-break timeline, only
 *   the shift's break total). When the server has flagged the running shift's
 *   breaks as legally insufficient (`breakShortfallMs > 0`, ArbZG §4), the
 *   recorded breaks do NOT reset the run — short breaks must not mask a long one.
 *   0 while clocked out.
 * - `backToBackMeetings`: honestly 0 — Today has no client meeting feed; an absent
 *   signal is absent, never guessed.
 * - `overtimeMsToday`: honestly 0 — the worktime summary's `balanceMs` is a
 *   trailing-week balance, not a today-scoped figure, so there is no honest figure to
 *   pass; the long-day cap covers the intraday story from real worked time.
 * - `baselineNormalHigh` / `consecutiveHeavyDays`: from `computeBaseline` over the
 *   caller's own history; while the history is absent the band is `+∞` and the run
 *   0, so nothing baseline-derived can ever fire early.
 */
export function liveLoadInputFrom(src: LiveLoadSources): LiveLoadInput {
  const today = localDayKey(src.now)

  let workedMsToday = 0
  for (const shift of src.shifts) {
    if (shift.endedAt === null) continue
    if (localDayKey(Date.parse(shift.endedAt)) !== today) continue
    workedMsToday += netShiftMs(shift.startedAt, shift.endedAt, shift.breakMs)
  }

  let focusMsSinceBreak = 0
  if (src.running !== null) {
    const elapsed = Math.max(0, src.now - Date.parse(src.running.startedAt))
    const netRunning = Math.max(0, elapsed - src.running.breakMs)
    workedMsToday += netRunning
    focusMsSinceBreak = src.running.breakShortfallMs > 0 ? elapsed : netRunning
  }

  const baseline = src.history === null ? null : computeBaseline(src.history)

  return {
    now: src.now,
    workedMsToday,
    focusMsSinceBreak,
    backToBackMeetings: 0,
    overtimeMsToday: 0,
    baselineNormalHigh: baseline?.normalHigh ?? Number.POSITIVE_INFINITY,
    consecutiveHeavyDays: src.history === null ? 0 : trailingHeavyRun(src.history),
  }
}

/** How often to re-derive while the app is open (cheap, no network — cf. `useTrackReminder`). */
const TICK_MS = 30_000

export function useLiveLoad(): LiveLoadResource {
  const worktime = useWorktime()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [history, setHistory] = useState<readonly LoadHistoryDay[] | null>(null)
  const [historyPending, setHistoryPending] = useState(apiBaseUrl !== null)

  // One-shot history fetch: on failure the baseline stays wide open (+∞ band) —
  // the universal hard caps still work off real worked time, nothing else fires.
  useEffect(() => {
    let alive = true
    if (apiBaseUrl === null) return
    getLoadHistory(apiBaseUrl)
      .then(days => {
        if (alive) setHistory(days)
      })
      .catch(() => {
        if (alive) setHistory(null)
      })
      .finally(() => {
        if (alive) setHistoryPending(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // The 30 s re-evaluation tick (mirrors `useTrackReminder`).
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now())
    }, TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  const load = useMemo(
    () =>
      evaluateLiveLoad(
        liveLoadInputFrom({
          now: nowMs,
          running: worktime.running,
          shifts: worktime.shifts,
          history,
        }),
      ),
    [nowMs, worktime.running, worktime.shifts, history],
  )

  return { load, loading: worktime.loading || historyPending }
}
