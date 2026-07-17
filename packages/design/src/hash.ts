/**
 * A tiny FNV-1a string hash — the one place the design system turns an id into a
 * stable number. Deterministic assignment (a project's color, a person's sage
 * shade) must be a pure function of the id so the same entity always renders in
 * the same color across devices and sessions; a hash gives that without storing a
 * color per row. 32-bit FNV-1a is small, fast, and has good avalanche for the
 * short ids we hash. Returned unsigned so callers can `% paletteSize` directly.
 */

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

/** 32-bit FNV-1a hash of `id`, as an unsigned integer. */
export function fnv1a(id: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0 // unsigned
}
