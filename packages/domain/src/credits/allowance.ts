import type { Plan } from '../entitlements/types.js'

/**
 * The credit **entitlement** knobs (REQ-027, ADR-0008): how many AI credits a plan's
 * monthly allowance grants, and the fixed top-up packs a workspace can buy. Pure config +
 * lookups (ADR-0005) — the impure `billing` service grants these amounts through the
 * append-only ledger, idempotently, on the verified subscription/purchase that earns them.
 * The numbers live here so a client can show them and the server grants them from one
 * source of truth, never a scattered literal.
 */

/**
 * Credits granted per billing month for a plan's allowance. `free` earns nothing from the
 * subscription path (a free monthly allowance, if ever offered, would be a scheduled grant,
 * not a purchase event); `pro` earns its monthly bundle on each renewal.
 */
const MONTHLY_ALLOWANCE: Record<Plan, number> = {
  free: 0,
  pro: 500,
}

/** The monthly credit allowance for a plan (0 when the plan earns none from renewals). */
export function monthlyCreditAllowance(plan: Plan): number {
  return MONTHLY_ALLOWANCE[plan]
}

/** A one-time credit pack a workspace can purchase to top up its balance. */
export interface TopUpPack {
  readonly id: string
  /** Credits added to the balance on purchase. */
  readonly credits: number
}

/** The fixed top-up catalog — a purchase of pack `id` grants `credits`. */
export const TOPUP_PACKS: readonly TopUpPack[] = [
  { id: 'pack_small', credits: 200 },
  { id: 'pack_medium', credits: 550 },
  { id: 'pack_large', credits: 1200 },
]

/** The credits a top-up pack grants, or null when the id is not a known pack. */
export function topUpPackCredits(packId: string): number | null {
  return TOPUP_PACKS.find(p => p.id === packId)?.credits ?? null
}
