import type { Provider } from '@nestjs/common'
import { JiraExportTarget, readJiraExportConfig } from './jira-target.js'
import { LinearExportTarget, readLinearExportConfig } from './linear-target.js'
import { SlackExportTarget, readSlackExportConfig } from './slack-target.js'
import { NullExportTarget } from './null-export.js'
import type { ExportTargetPort } from './port.js'

/**
 * DI token for the dev-tool export target **registry** (REQ-035, #44 · ADR-0035). The run endpoint
 * names its target per request, so the binding is a resolver: `'jira' | 'linear' | 'slack'` yields
 * that live adapter when its environment is fully configured, and the `NullExportTarget` otherwise
 * (unknown names included) — runs against an unconfigured target degrade to honest `unavailable`
 * outcomes, recorded, never half-posted (ADR-0005, mirrors the `NullLlm` default of ADR-0029).
 * Features depend on this token and the narrow `ExportTargetPort` — never a vendor SDK.
 */
export const EXPORT_TARGET = Symbol('EXPORT_TARGET')

/** Resolves a request's target name to the port to send through. Total: never throws, never null. */
export type ExportTargetResolver = (name: string) => ExportTargetPort

/**
 * Build the resolver from the environment (config read in the factory, never at import — mirrors
 * `llm.provider.ts`). `fetchImpl` is injectable for tests; the live adapters default to global fetch.
 */
export function createExportTargetResolver(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): ExportTargetResolver {
  return (name: string): ExportTargetPort => {
    switch (name) {
      case 'jira':
        return readJiraExportConfig(env) !== null
          ? new JiraExportTarget(env, fetchImpl)
          : new NullExportTarget()
      case 'linear':
        return readLinearExportConfig(env) !== null
          ? new LinearExportTarget(env, fetchImpl)
          : new NullExportTarget()
      case 'slack':
        return readSlackExportConfig(env) !== null
          ? new SlackExportTarget(env, fetchImpl)
          : new NullExportTarget()
      default:
        return new NullExportTarget()
    }
  }
}

/** Binds the env-driven resolver; consumers inject `EXPORT_TARGET` as an `ExportTargetResolver`. */
export const exportTargetProvider: Provider = {
  provide: EXPORT_TARGET,
  useFactory: (): ExportTargetResolver => createExportTargetResolver(),
}
