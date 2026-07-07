/**
 * Public contract of the `tracking` module — Time entries, projects, attendance, budgets (REQ-001/003-005). M1.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface TrackingModule {
  readonly name: 'tracking'
}
