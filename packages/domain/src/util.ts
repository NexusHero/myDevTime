/**
 * Foundational pure helpers for the domain core. Real tracking-core logic
 * (time-entry math, overlap, rounding) lands in issue #7 (REQ-003); these are
 * the primitives it and every other module build on.
 */

/**
 * Exhaustiveness guard for discriminated unions. Reaching this at runtime means
 * a case was added without handling — fail loudly rather than degrade silently.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}

/**
 * Clamp `value` into the inclusive range [min, max].
 * @throws if the range is inverted (min > max) — a programming error, not input.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new Error(`invalid range: min (${String(min)}) > max (${String(max)})`)
  }
  if (value < min) return min
  if (value > max) return max
  return value
}
