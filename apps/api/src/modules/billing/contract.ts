/**
 * Public contract of the `billing` module — Entitlements + credit ledger + payment adapters (ADR-0006/0008). M4.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface BillingModule {
  readonly name: 'billing'
}

/**
 * The credit-ledger seam other modules may consume (ADR-0008): read the balance
 * and record an idempotent debit. Feature gates ask billing — they never touch a
 * payment SDK, and the ledger internals stay private.
 */
export { balanceFor, debit } from './credits-service.js'
export type { DebitInput } from './credits-service.js'
