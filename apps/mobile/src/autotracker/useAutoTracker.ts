import { useEffect, useRef, useState } from 'react'
import { summarizeActivity, type ActivityBreakdown, type ActivitySample } from '@mydevtime/domain'
import { platformCapture } from './capture.js'

/** How many sources to show before folding the tail into "Others". */
const TOP_N = 4

/**
 * Live Auto-Tracker breakdown for the current session (REQ-042, ADR-0057). Captures
 * activity only while `enabled` (the `autoTracker` consent) **and** `active` (a timer
 * is running), accumulating first-party spans locally and re-summarizing on each one.
 * Returns `null` when disabled/inactive or nothing has been observed yet, so the
 * caller renders an honest empty state. Nothing is persisted or sent off-device.
 */
export function useAutoTracker(enabled: boolean, active: boolean): ActivityBreakdown | null {
  const [breakdown, setBreakdown] = useState<ActivityBreakdown | null>(null)
  const samples = useRef<ActivitySample[]>([])

  useEffect(() => {
    if (!enabled || !active) {
      samples.current = []
      setBreakdown(null)
      return
    }
    samples.current = []
    const stop = platformCapture().start(sample => {
      samples.current = [...samples.current, sample]
      setBreakdown(summarizeActivity(samples.current, { topN: TOP_N }))
    })
    return stop
  }, [enabled, active])

  return breakdown
}
