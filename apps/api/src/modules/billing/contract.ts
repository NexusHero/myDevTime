/**
 * Public contract of the `billing` module — Entitlements + credit ledger + payment adapters (ADR-0006/0008). M4.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface BillingModule {
  readonly name: 'billing'
}
