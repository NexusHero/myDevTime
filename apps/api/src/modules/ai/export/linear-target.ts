import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

/**
 * The live Linear adapter behind the `ExportTargetPort` (REQ-035, #44 · ADR-0035; skill §2.2): one
 * confirmed item becomes one issue via the GraphQL `issueCreate` mutation against
 * `https://api.linear.app/graphql`. All Linear knowledge — the GraphQL wire shape, its
 * 200-with-`errors`-array failure convention — is confined to this file; nothing upstream imports a
 * vendor type. Configuration is environment-only (mirrors `llm.provider.ts`): unconfigured means
 * `available()` is false and the runner degrades to honest `unavailable` outcomes (ADR-0005). A
 * network/HTTP/GraphQL failure is returned as `{ ok: false }` — the recorded `failed` outcome —
 * never thrown uncaught.
 */

/** Everything the adapter needs to reach Linear; read from the environment, never source. */
export interface LinearExportConfig {
  readonly apiKey: string
  readonly teamId: string
}

const str = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value.trim()

/**
 * Resolve the Linear config from the environment. Returns `null` — meaning "not configured, use the
 * Null target" — unless both `EXPORT_LINEAR_API_KEY` and `EXPORT_LINEAR_TEAM_ID` are set.
 */
export function readLinearExportConfig(
  env: NodeJS.ProcessEnv = process.env,
): LinearExportConfig | null {
  const apiKey = str(env.EXPORT_LINEAR_API_KEY)
  const teamId = str(env.EXPORT_LINEAR_TEAM_ID)
  if (apiKey === null || teamId === null) return null
  return { apiKey, teamId }
}

export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql'

const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      identifier
      url
    }
  }
}`

/** The slice of Linear's GraphQL response this adapter reads. */
interface LinearIssueCreateResponse {
  readonly data?: {
    readonly issueCreate?: {
      readonly success?: boolean
      readonly issue?: { readonly identifier?: unknown; readonly url?: unknown } | null
    } | null
  } | null
  readonly errors?: readonly { readonly message?: unknown }[]
}

const REQUEST_TIMEOUT_MS = 10_000

export class LinearExportTarget implements ExportTargetPort {
  readonly target = 'linear' as const
  private readonly config: LinearExportConfig | null

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.config = readLinearExportConfig(env)
  }

  /** Configured-only availability: no probe request, just "is every env var present" (cheap). */
  available(): Promise<boolean> {
    return Promise.resolve(this.config !== null)
  }

  async send(item: ExportItem): Promise<ExportResult> {
    const config = this.config
    if (config === null) {
      throw new ExportUnavailableError('linear', 'linear export is not configured')
    }
    try {
      const res = await this.fetchImpl(LINEAR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: ISSUE_CREATE_MUTATION,
          variables: {
            input: {
              teamId: config.teamId,
              title: item.title,
              ...(item.body === undefined || item.body === '' ? {} : { description: item.body }),
            },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { ok: false, error: `linear responded ${String(res.status)}` }
      }
      const payload = (await res.json()) as LinearIssueCreateResponse
      // GraphQL failures come back HTTP 200 with an `errors` array — that is a failed send.
      if (payload.errors !== undefined && payload.errors.length > 0) {
        const message = payload.errors
          .map(e => (typeof e.message === 'string' ? e.message : 'unknown error'))
          .join('; ')
        return { ok: false, error: `linear error: ${message}` }
      }
      const created = payload.data?.issueCreate
      const identifier = created?.issue?.identifier
      if (created?.success !== true || typeof identifier !== 'string' || identifier === '') {
        return { ok: false, error: 'linear response is missing the created issue' }
      }
      const url = created.issue?.url
      return {
        ok: true,
        externalId: identifier,
        ...(typeof url === 'string' && url !== '' ? { url } : {}),
      }
    } catch (err) {
      return {
        ok: false,
        error: `linear request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }
  }
}
