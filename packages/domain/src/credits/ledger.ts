/**
 * The AI-credit ledger core (REQ-027, ADR-0008). Credits are an append-only log of
 * **signed** integer deltas: grants and top-ups add, debits and expiries subtract.
 * The balance and the usage breakdown are derived from the log — never stored as a
 * mutable counter — so the ledger is auditable and a feature gate reads the truth
 * here, not a payment SDK. Pure and deterministic (ADR-0005).
 */

export type CreditEntryKind = 'grant' | 'topup' | 'debit' | 'expiry' | 'adjustment'

export interface CreditEntry {
  readonly kind: CreditEntryKind
  /** Signed integer credits: grants/top-ups > 0, debits/expiries < 0. */
  readonly amount: number
  /** What the entry is for (e.g. `monthly-grant`, `meeting-insights`, `assistant`). */
  readonly category: string
  /** ISO instant the entry was recorded. */
  readonly at: string
}

/** The current balance: the sum of every signed delta. */
export function creditBalance(entries: readonly CreditEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0)
}

export interface UsageBucket {
  readonly category: string
  /** Total credits spent in the category (a positive number). */
  readonly credits: number
}

/**
 * Credits spent per category — debits only, as positive numbers, highest first.
 * Grants and top-ups are excluded (they are not usage).
 */
export function usageByCategory(entries: readonly CreditEntry[]): UsageBucket[] {
  const spent = new Map<string, number>()
  for (const e of entries) {
    if (e.amount >= 0) continue
    spent.set(e.category, (spent.get(e.category) ?? 0) + -e.amount)
  }
  return [...spent.entries()]
    .map(([category, credits]) => ({ category, credits }))
    .sort((a, b) => b.credits - a.credits || a.category.localeCompare(b.category))
}

/** Whether a positive `amount` can be debited without overdrawing the balance. */
export function canDebit(entries: readonly CreditEntry[], amount: number): boolean {
  if (!(amount > 0)) return false
  return creditBalance(entries) >= amount
}
