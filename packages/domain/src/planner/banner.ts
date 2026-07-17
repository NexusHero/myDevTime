/**
 * Contextual-banner resolver (REQ-059, design v14 §M2) — pure and deterministic (ADR-0005).
 * The Planner may show **at most one** contextual banner, and the four variants collapse to a
 * single `ContextBanner` (one component, a `variant` prop). When several would apply at once,
 * a fixed priority decides which shows and the rest wait: **Conflict > Price-of-week >
 * Yesterday-healing > Note**. This is the simplification pass's "max. EIN Banner" made law in
 * code, so no client can stack banners.
 */

/** The four banner kinds, highest-priority first. */
export type BannerVariant = 'conflict' | 'price' | 'healing' | 'note'

/** The binding priority order (index 0 = highest). */
export const BANNER_PRIORITY: readonly BannerVariant[] = ['conflict', 'price', 'healing', 'note']

const RANK: Record<BannerVariant, number> = {
  conflict: 0,
  price: 1,
  healing: 2,
  note: 3,
}

export interface ContextBanner {
  readonly variant: BannerVariant
  /** Opaque UI payload (copy, ids…). The resolver ranks by `variant` only and keeps the rest. */
  readonly message?: string
}

/**
 * Pick the single banner to show from the candidates, by the fixed priority. Ties within a
 * variant break toward the earlier candidate (stable), and the winner's full payload is
 * returned unchanged. Returns `null` when there is nothing to show.
 */
export function pickBanner<T extends { readonly variant: BannerVariant }>(
  candidates: readonly T[],
): T | null {
  let best: T | null = null
  for (const candidate of candidates) {
    if (best === null || RANK[candidate.variant] < RANK[best.variant]) {
      best = candidate
    }
  }
  return best
}
