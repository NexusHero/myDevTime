import type { ToastApi } from '../components/core/Toast'

/**
 * stopSummaryToast (issue #363) — formalizes the "Timer stopped — X tracked." toast so the
 * hero bar and the Planner Day view fire it consistently. It is a thin wrapper over
 * [`useToast`](../components/core/Toast.tsx) — no new logic — but it owns the one invariant
 * the grilling called out: the elapsed snapshot must be taken **before** `punchOut()` (the
 * optimistic clear), so the toast reports the real tracked time, not the post-clear zero.
 *
 * The deterministic core ([`useTimer`](../hooks/useTimer.ts)) owns the elapsed figure
 * (ADR-0005); this only reads it and confirms the stop. English-only copy (UI is English-only).
 */
export interface StopSummaryContext {
  /** The formatted elapsed snapshot, read BEFORE the stop clears it. */
  readonly elapsed: string
  /** Stop the session (the optimistic clear happens inside this call). */
  readonly punchOut: () => void
}

/**
 * Stop the timer and fire the "Timer stopped — X tracked." toast. The elapsed snapshot is
 * captured before `punchOut()` runs, so the toast always reflects the real tracked time.
 */
export function stopSummaryToast(toast: ToastApi, ctx: StopSummaryContext): void {
  const tracked = ctx.elapsed // snapshot before the optimistic clear
  ctx.punchOut()
  if (tracked.length === 0) return // not a real stop — no toast (matches useToast's trim guard)
  toast.show(`Timer stopped — ${tracked} tracked.`)
}
