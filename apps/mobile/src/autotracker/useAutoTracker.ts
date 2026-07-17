import { useEffect, useRef, useState } from 'react'
import { summarizeActivity, type ActivityBreakdown, type ActivitySample } from '@mydevtime/domain'
import { platformCapture } from './capture.js'
import { clearActivitySamples, loadActivitySamples, saveActivitySamples } from './activityStore.js'
import { appendDaySpans } from './dayActivityStore.js'

/** How many sources to show before folding the tail into "Others". */
const TOP_N = 4

const summarize = (samples: readonly ActivitySample[]): ActivityBreakdown | null =>
  samples.length > 0 ? summarizeActivity(samples, { topN: TOP_N }) : null

/**
 * Live Auto-Tracker breakdown for the current session (REQ-042, ADR-0057 — local-only).
 * Captures activity only while `enabled` (the `autoTracker` consent) **and** `active`
 * (a timer is running), accumulating first-party spans and re-summarizing on each one.
 * Returns `null` when disabled/inactive or nothing has been observed yet, so the
 * caller renders an honest empty state.
 *
 * The session buffer is persisted **only on this device** (`activityStore`), so the
 * breakdown survives a reload or a mid-session relaunch — and is cleared the moment
 * the session ends (consent off or the timer stops). In parallel, each captured span
 * is filed into the **per-day reality history** (`dayActivityStore`, ADR-0064) keyed
 * by its local day — that history is *not* wiped at session end, so the Planner can
 * later draw yesterday's reality trace and heal an unbooked gap. Nothing is ever sent
 * off-device: app-activity is behaviour-near data, so it stays where it was observed.
 */
export function useAutoTracker(enabled: boolean, active: boolean): ActivityBreakdown | null {
  const [breakdown, setBreakdown] = useState<ActivityBreakdown | null>(null)
  const samples = useRef<ActivitySample[]>([])

  useEffect(() => {
    if (!enabled || !active) {
      // Session ended → forget the local buffer (an unmount/reload leaves it intact).
      samples.current = []
      clearActivitySamples()
      setBreakdown(null)
      return
    }
    // (Re)entering a session: restore any buffer left on this device by a reload.
    samples.current = loadActivitySamples()
    setBreakdown(summarize(samples.current))
    const stop = platformCapture().start(
      sample => {
        samples.current = [...samples.current, sample]
        saveActivitySamples(samples.current)
        setBreakdown(summarize(samples.current))
      },
      // Timestamped spans feed the durable per-day reality history (kept across
      // session-end for the Planner's reality layer), consent/session-gated by the
      // same effect. Local-only — never uploaded.
      span => {
        appendDaySpans([span])
      },
    )
    return stop
  }, [enabled, active])

  return breakdown
}
