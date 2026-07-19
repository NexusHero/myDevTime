import type { ExternalIssue } from '@mydevtime/domain'

/**
 * The one narrow issue-import interface the app sees (ADR-0005; skill §2.2). GitHub Issues and
 * Azure DevOps Work Items are volatile vendors: each is reached through a single adapter that
 * confines the vendor REST shape/auth to that one file and translates its tickets into the
 * neutral domain `ExternalIssue`. **Nothing upstream imports a vendor type.** The port only
 * *reads* — it lists the caller's tickets; what happens to them is the deterministic
 * `toTaskProposals` core's decision (ADR-0005), which yields candidate-task proposals the user
 * confirms, never an auto-created task. Live adapters are gated on their integration handback
 * (a GitHub OAuth app + token, an Azure DevOps org + PAT/OAuth); the Null adapter ships now as
 * the graceful-degradation default and the seam features test against.
 */

/** Issue-import providers. `null` is the graceful-degradation default (no provider configured). */
export type IssueImportProvider = 'github' | 'azure-devops' | 'null'

/** How the caller narrows the listing — `open` (default) or `all` (open + closed). */
export interface ListIssuesOptions {
  readonly state?: 'open' | 'all'
}

/**
 * The narrow issue-import port. A feature depends on this, never a vendor SDK; the concrete
 * adapter is selected by config + stored consent at composition time. Implementations must be
 * read-only and side-effect-free beyond the provider call — they never mutate app state (that is
 * the confirmed-import flow's job, over the deterministic `toTaskProposals` core).
 */
export interface IssueImportPort {
  readonly provider: IssueImportProvider
  /** Whether the provider is configured, consented, and reachable (cheap; no fetch). */
  available(): Promise<boolean>
  /**
   * List the caller's tickets. Throws `IssueImportUnavailableError` when the provider is down or
   * unconfigured; returns `[]` when there are simply no tickets.
   */
  listIssues(opts: ListIssuesOptions): Promise<readonly ExternalIssue[]>
}

/**
 * Thrown when no issue-import provider is configured/consented or the chosen one is unreachable.
 * The import flow must handle this and degrade — the deterministic core never depends on a tracker
 * being connected (ADR-0005), and an unconfigured deployment reports `unavailable`, never a fake
 * import.
 */
export class IssueImportUnavailableError extends Error {
  readonly provider: IssueImportProvider
  constructor(provider: IssueImportProvider, message = 'issue-import provider is not available') {
    super(message)
    this.name = 'IssueImportUnavailableError'
    this.provider = provider
  }
}
