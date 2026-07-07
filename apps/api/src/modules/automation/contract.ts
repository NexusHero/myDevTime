/**
 * Public contract of the `automation` module — Calendar ingestion + deterministic rules engine (REQ-010/011). M3.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface AutomationModule {
  readonly name: 'automation'
}
