import type { Provider } from '@nestjs/common'
import { NullExportTarget } from './null-export.js'
import type { ExportTargetPort } from './port.js'

/**
 * DI token for the configured dev-tool export target (REQ-035, ADR-0035). Features
 * depend on this token and the narrow `ExportTargetPort` — never a vendor SDK.
 */
export const EXPORT_TARGET = Symbol('EXPORT_TARGET')

/**
 * Binds the `NullExportTarget` until a live Jira/Linear/Slack adapter passes its
 * integration spike (mirrors the `NullLlm` default, ADR-0029): runs degrade to honest
 * `unavailable` outcomes — recorded, never half-posted (ADR-0005).
 */
export const exportTargetProvider: Provider = {
  provide: EXPORT_TARGET,
  useFactory: (): ExportTargetPort => new NullExportTarget(),
}
