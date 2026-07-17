/**
 * The one narrow dev-tool export interface the app sees (REQ-035, ADR-0035; skill §2.2). Jira,
 * Linear and Slack are each reached through a single adapter that confines its SDK/auth to that
 * file. **Nothing upstream imports a vendor type.** Export is **confirmed-only and previewed**: the
 * runner sends only items the user confirmed, and it is **idempotent** — an item carries a stable
 * `dedupeKey`, so re-running never double-posts. Every send returns a recorded `ExportResult` (the
 * external id/url), so the outcome is auditable. The live adapters are gated on their integration
 * spike; the Null adapter ships now as the seam.
 */

export type ExportTarget = 'jira' | 'linear' | 'slack' | 'null'

/** One thing to export — an insight/action item the user confirmed. `dedupeKey` makes it idempotent. */
export interface ExportItem {
  /** Stable key identifying this item across runs (e.g. `meeting:<id>:action:<n>`). */
  readonly dedupeKey: string
  readonly title: string
  readonly body?: string
  /** Only confirmed items are ever sent (REQ-035). */
  readonly confirmed: boolean
}

/** The recorded outcome of a send — auditable, so a re-run can prove the item already landed. */
export interface ExportResult {
  readonly ok: boolean
  /** The created item's id in the target tool, when the send succeeded. */
  readonly externalId?: string
  readonly url?: string
  readonly error?: string
}

/**
 * The narrow export port. A feature depends on this, never a vendor SDK; the concrete adapter is
 * selected by config + stored consent at composition time. Implementations only *send* one item.
 */
export interface ExportTargetPort {
  readonly target: ExportTarget
  /** Send one confirmed item. Throws `ExportUnavailableError` when the target is down. */
  send(item: ExportItem): Promise<ExportResult>
  /** Whether the target is configured, consented and reachable (cheap; no send). */
  available(): Promise<boolean>
}

/**
 * Thrown when no export target is configured/consented or the chosen one is unreachable. The runner
 * handles this and degrades — nothing is half-sent (ADR-0005).
 */
export class ExportUnavailableError extends Error {
  readonly target: ExportTarget
  constructor(target: ExportTarget, message = 'export target is not available') {
    super(message)
    this.name = 'ExportUnavailableError'
    this.target = target
  }
}
