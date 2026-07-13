import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { easeTo, motion } from '@mydevtime/design'

/**
 * useMountValue — drives a number from 0 to `target` once on mount, eased with
 * the design system's `easeOutCubic` (via `easeTo`, ADR-0005). This is the one
 * primitive behind the v4 motion pass's count-ups and draw-ins (BudgetRing,
 * Gauge, Sparkline, LeaveBalance, …): the client only wires the pure curve to
 * `requestAnimationFrame`.
 *
 * Faithful to the design system's web instruments, which animate the same way
 * (rAF + eased progress), not with CSS transitions — so native and web behave
 * identically. Motion is gated behind the OS reduced-motion setting: when the
 * user opts out, the value is the target immediately, with no animation frame.
 *
 * Pass `target = 1` to get a plain 0→1 progress driver for staggered reveals.
 */
export function useMountValue(target: number, durationMs: number = motion.slow): number {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? target : 0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce) {
      setValue(target)
      return
    }
    let start: number | null = null
    const step = (ts: number): void => {
      start ??= ts
      const p = Math.min((ts - start) / durationMs, 1)
      setValue(easeTo(target, p))
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return (): void => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs, reduce])

  return value
}
