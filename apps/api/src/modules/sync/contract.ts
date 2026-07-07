/**
 * Public contract of the `sync` module — Offline-first cross-device sync (REQ-006). Issue #9.
 *
 * Other modules depend ONLY on this file (interfaces/types), never on the
 * module's internals; wiring happens in app.ts. The boundary test enforces it.
 */
export interface SyncModule {
  readonly name: 'sync'
}
