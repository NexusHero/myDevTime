import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

/**
 * The graceful-degradation default (REQ-035, mirrors ADR-0029's `NullLlm`): the `ExportTargetPort`
 * used when no dev-tool target is configured/consented or none is reachable. `available()` is always
 * false and `send()` refuses with `ExportUnavailableError`, so the runner degrades to "nothing sent"
 * rather than half-posting (ADR-0005). It is the seam the export runner tests against before any live
 * Jira/Linear/Slack adapter exists (those are gated on their integration spike).
 */
export class NullExportTarget implements ExportTargetPort {
  readonly target = 'null' as const

  send(_item: ExportItem): Promise<ExportResult> {
    return Promise.reject(new ExportUnavailableError('null', 'no export target configured'))
  }

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }
}
