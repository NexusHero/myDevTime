import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

/**
 * The live Jira Cloud adapter behind the `ExportTargetPort` (REQ-035, #44 · ADR-0035; skill §2.2):
 * one confirmed item becomes one issue via `POST {baseUrl}/rest/api/3/issue` with basic auth. All
 * Jira knowledge — REST shape, Atlassian Document Format, browse URLs — is confined to this file;
 * nothing upstream imports a vendor type. Configuration is environment-only (mirrors
 * `llm.provider.ts`): unconfigured means `available()` is false and the runner degrades to honest
 * `unavailable` outcomes (ADR-0005). A network/HTTP failure is returned as `{ ok: false }` — the
 * recorded `failed` outcome — never thrown uncaught.
 */

/** Everything the adapter needs to reach Jira Cloud; read from the environment, never source. */
export interface JiraExportConfig {
  /** Site base, e.g. `https://acme.atlassian.net` (trailing slashes stripped). */
  readonly baseUrl: string
  readonly email: string
  readonly apiToken: string
  readonly projectKey: string
  /** Issue type name; `EXPORT_JIRA_ISSUE_TYPE`, defaulting to `Task`. */
  readonly issueType: string
}

const str = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value.trim()

/**
 * Resolve the Jira config from the environment. Returns `null` — meaning "not configured, use the
 * Null target" — unless every required variable is set: `EXPORT_JIRA_BASE_URL`,
 * `EXPORT_JIRA_EMAIL`, `EXPORT_JIRA_API_TOKEN`, `EXPORT_JIRA_PROJECT_KEY`.
 */
export function readJiraExportConfig(
  env: NodeJS.ProcessEnv = process.env,
): JiraExportConfig | null {
  const baseUrl = str(env.EXPORT_JIRA_BASE_URL)
  const email = str(env.EXPORT_JIRA_EMAIL)
  const apiToken = str(env.EXPORT_JIRA_API_TOKEN)
  const projectKey = str(env.EXPORT_JIRA_PROJECT_KEY)
  if (baseUrl === null || email === null || apiToken === null || projectKey === null) return null
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    email,
    apiToken,
    projectKey,
    issueType: str(env.EXPORT_JIRA_ISSUE_TYPE) ?? 'Task',
  }
}

/** The minimal Atlassian Document Format wrapper Jira v3 requires for issue descriptions. */
interface AdfDocument {
  readonly type: 'doc'
  readonly version: 1
  readonly content: readonly {
    readonly type: 'paragraph'
    readonly content: readonly { readonly type: 'text'; readonly text: string }[]
  }[]
}

const adfDocument = (text: string): AdfDocument => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

const REQUEST_TIMEOUT_MS = 10_000

export class JiraExportTarget implements ExportTargetPort {
  readonly target = 'jira' as const
  private readonly config: JiraExportConfig | null

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.config = readJiraExportConfig(env)
  }

  /** Configured-only availability: no probe request, just "is every env var present" (cheap). */
  available(): Promise<boolean> {
    return Promise.resolve(this.config !== null)
  }

  async send(item: ExportItem): Promise<ExportResult> {
    const config = this.config
    if (config === null) {
      throw new ExportUnavailableError('jira', 'jira export is not configured')
    }
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    try {
      const res = await this.fetchImpl(`${config.baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: config.projectKey },
            summary: item.title,
            issuetype: { name: config.issueType },
            ...(item.body === undefined || item.body === ''
              ? {}
              : { description: adfDocument(item.body) }),
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { ok: false, error: `jira responded ${String(res.status)}` }
      }
      const payload = (await res.json()) as { key?: unknown }
      if (typeof payload.key !== 'string' || payload.key === '') {
        return { ok: false, error: 'jira response is missing the issue key' }
      }
      return { ok: true, externalId: payload.key, url: `${config.baseUrl}/browse/${payload.key}` }
    } catch (err) {
      return {
        ok: false,
        error: `jira request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }
  }
}
