import {
  IssueImportUnavailableError,
  type IssueImportPort,
  type ListIssuesOptions,
} from './port.js'
import type { ExternalIssue } from '@mydevtime/domain'

/**
 * The graceful-degradation default (mirrors `NullCalendar`): the `IssueImportPort` used when no
 * tracker is connected/consented or none is reachable. `available()` is always false and
 * `listIssues()` refuses with `IssueImportUnavailableError`, so the import flow reports an honest
 * `unavailable` and the deterministic core is untouched (ADR-0005). It never fabricates a ticket.
 * It is also the seam the import features test against before any live GitHub/Azure adapter is
 * wired (those are gated on their integration handback).
 */
export class NullIssueImport implements IssueImportPort {
  readonly provider = 'null' as const

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }

  listIssues(_opts: ListIssuesOptions): Promise<readonly ExternalIssue[]> {
    return Promise.reject(
      new IssueImportUnavailableError('null', 'no issue-import provider configured'),
    )
  }
}
