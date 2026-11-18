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

/**
 * Ordinal (UTF-16 code unit) string comparator for `Array.prototype.sort`.
 * Deliberately locale-independent: `localeCompare` would make sort order — and
 * therefore every derived number or export — depend on the host's ICU locale,
 * which the deterministic core (ADR-0005) must not. ISO dates and day keys sort
 * chronologically under it.
 */
export function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Remove every trailing `/` from a URL or path. Linear-time replacement for
 * `s.replace(/\/+$/, '')`, whose backtracking is quadratic on slash runs.
 */
export function stripTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value.codePointAt(end - 1) === 0x2f) end -= 1
  return value.slice(0, end)
}
