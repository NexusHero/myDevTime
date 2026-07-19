import { toTaskProposals, type CandidateTaskProposal, type ExternalIssue } from '@mydevtime/domain'
import {
  IssueImportUnavailableError,
  type IssueImportPort,
  type IssueImportProvider,
  type ListIssuesOptions,
} from './port.js'
import { GithubImport } from './github-import.js'
import { AzureImport } from './azure-import.js'
import { NullIssueImport } from './null-import.js'

/**
 * Issue-import planning (ADR-0005): list a tracker's tickets through the narrow `IssueImportPort`
 * and map them to candidate-task proposals via the deterministic `toTaskProposals` core. The result
 * is a **proposal queue** — candidate tasks the user confirms — never a write. Two hard gates come
 * first: **consent** (no capture path without stored opt-in, REQ-025) and **availability** (a
 * down/unconfigured tracker degrades to "nothing proposed", never throws up the stack). Live
 * GitHub/Azure adapters are handback-gated; the Null adapter exercises this seam.
 */

/**
 * Map an issues connector id (registry) → the neutral `IssueImportProvider`. Anything
 * that is not a known issues tracker resolves to `'null'` (graceful degradation).
 */
export function providerForConnector(id: string): IssueImportProvider {
  switch (id) {
    case 'github':
      return 'github'
    case 'azure-devops':
      return 'azure-devops'
    default:
      return 'null'
  }
}

/** What each adapter needs from the composition root; all optional so callers wire only what applies. */
export interface IssueImportPortDeps {
  /** A live OAuth/PAT access token, or `null` when not connected/refreshable. */
  readonly accessToken?: () => Promise<string | null>
  /** Azure DevOps org + project (config, never source) — required for the Azure adapter. */
  readonly azure?: { readonly org: string; readonly project: string }
  /** Test/override transport for the HTTP adapters. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Resolve the read-only `IssueImportPort` for a provider, wiring the deps each adapter needs
 * (skill §2.2 — the one place adapters are selected). github → GithubImport, azure-devops →
 * AzureImport, everything else → NullIssueImport. A provider missing its required config
 * (an OAuth token, or Azure's org/project) degrades to Null rather than pretending to be connected.
 */
export function resolveIssueImportPort(
  provider: IssueImportProvider,
  deps: IssueImportPortDeps = {},
): IssueImportPort {
  switch (provider) {
    case 'github':
      return deps.accessToken === undefined
        ? new NullIssueImport()
        : new GithubImport({
            accessToken: deps.accessToken,
            ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
          })
    case 'azure-devops':
      return deps.accessToken === undefined || deps.azure === undefined
        ? new NullIssueImport()
        : new AzureImport({
            org: deps.azure.org,
            project: deps.azure.project,
            accessToken: deps.accessToken,
            ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
          })
    default:
      return new NullIssueImport()
  }
}

export interface ImportPreview {
  /** The deterministic proposals, or empty when the tracker is off/unconsented. */
  readonly proposals: readonly CandidateTaskProposal[]
  /** Why the preview is empty, when it is — surfaced honestly to the caller. */
  readonly status: 'ok' | 'no-consent' | 'unavailable'
}

const EMPTY = (status: ImportPreview['status']): ImportPreview => ({ proposals: [], status })

/**
 * Preview an issue import: consent-gated, availability-gated, then a deterministic mapping. Returns
 * proposals only — the caller creates nothing until the user confirms a candidate (via the existing
 * tracking endpoint). A provider that throws `IssueImportUnavailableError` mid-list degrades to an
 * empty `unavailable` preview (ADR-0005). `alreadyImportedKeys` is `[]` for now: there is no
 * imported-issue store yet, so every open ticket is proposed on each preview — documented honestly
 * rather than faked.
 */
export async function previewImport(
  port: IssueImportPort,
  consented: boolean,
  opts: ListIssuesOptions = {},
): Promise<ImportPreview> {
  if (!consented) return EMPTY('no-consent')
  if (!(await port.available())) return EMPTY('unavailable')
  let issues: readonly ExternalIssue[]
  try {
    issues = await port.listIssues(opts)
  } catch (err) {
    if (err instanceof IssueImportUnavailableError) return EMPTY('unavailable')
    throw err
  }
  const proposals = toTaskProposals(issues, [], { includeClosed: opts.state === 'all' })
  return { proposals, status: 'ok' }
}
