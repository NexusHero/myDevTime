import { describe, expect, it, vi } from 'vitest'
import { stopSummaryToast } from './stopSummaryToast.js'
import type { ToastApi } from '../components/core/Toast.js'

/**
 * stopSummaryToast (issue #363) formalizes the "Timer stopped — X tracked." toast so the
 * hero bar and the Planner fire it consistently. It is a thin wrapper over `useToast` —
 * no new logic — but it owns the one invariant the grilling called out: the elapsed
 * snapshot must be taken **before** `punchOut()` (the optimistic clear), so the toast
 * reports the real tracked time, not the post-clear zero.
 */
function makeToast(): ToastApi & { calls: string[] } {
  const calls: string[] = []
  return {
    show: (msg: string) => {
      calls.push(msg)
    },
    calls,
  }
}

describe('stopSummaryToast', () => {
  it('FiresToastWithElapsedBeforePunchOut', () => {
    const toast = makeToast()
    let elapsed = '01:23:45'
    let punchedOut = false
    const punchOut = (): void => {
      punchedOut = true
      elapsed = '00:00:00' // optimistic clear
    }
    stopSummaryToast(toast, { elapsed, punchOut })
    // The toast fired with the pre-clear snapshot.
    expect(toast.calls).toEqual(['Timer stopped — 01:23:45 tracked.'])
    // punchOut was called (the stop actually happened).
    expect(punchedOut).toBe(true)
  })

  it('SnapshotTakenBeforePunchOutClearsElapsed', () => {
    const toast = makeToast()
    const order: string[] = []
    const ctx = {
      get elapsed(): string {
        return '00:00:00'
      },
      punchOut: (): void => {
        order.push('punchOut')
      },
    }
    // Wrap so we can observe read order: the helper must read elapsed first.
    const observed = {
      get elapsed(): string {
        order.push('readElapsed')
        return ctx.elapsed
      },
      punchOut: ctx.punchOut,
    }
    stopSummaryToast(toast, observed)
    // The elapsed read happened before punchOut — the snapshot is pre-clear.
    expect(order).toEqual(['readElapsed', 'punchOut'])
  })

  it('DoesNotFireWhenElapsedIsEmpty', () => {
    const toast = makeToast()
    stopSummaryToast(toast, { elapsed: '', punchOut: () => undefined })
    // An empty elapsed is not a real stop — no toast (matches useToast's trim guard).
    expect(toast.calls).toEqual([])
  })

  it('CallsPunchOutExactlyOnce', () => {
    const toast = makeToast()
    const punchOut = vi.fn()
    stopSummaryToast(toast, { elapsed: '00:05:00', punchOut })
    expect(punchOut).toHaveBeenCalledTimes(1)
  })
})
