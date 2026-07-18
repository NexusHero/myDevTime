import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

/**
 * The live Slack adapter behind the `ExportTargetPort` (REQ-035, #44 · ADR-0035; skill §2.2): one
 * confirmed item becomes one `chat.postMessage` into the configured channel. All Slack knowledge —
 * the Web API's 200-with-`{ok:false}` failure convention, `ts` as the message id, the archive
 * permalink shape — is confined to this file; nothing upstream imports a vendor type. Configuration
 * is environment-only (mirrors `llm.provider.ts`): unconfigured means `available()` is false and
 * the runner degrades to honest `unavailable` outcomes (ADR-0005). A network/HTTP/API failure is
 * returned as `{ ok: false }` — the recorded `failed` outcome — never thrown uncaught.
 */

/** Everything the adapter needs to reach Slack; read from the environment, never source. */
export interface SlackExportConfig {
  readonly botToken: string
  /** Channel id or name to post into. */
  readonly channel: string
  /** Optional workspace base (e.g. `https://acme.slack.com`) used to build message permalinks. */
  readonly teamUrl?: string
}

const str = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value.trim()

/**
 * Resolve the Slack config from the environment. Returns `null` — meaning "not configured, use the
 * Null target" — unless both `EXPORT_SLACK_BOT_TOKEN` and `EXPORT_SLACK_CHANNEL` are set.
 * `EXPORT_SLACK_TEAM_URL` is optional and only enables permalink URLs in the recorded result.
 */
export function readSlackExportConfig(
  env: NodeJS.ProcessEnv = process.env,
): SlackExportConfig | null {
  const botToken = str(env.EXPORT_SLACK_BOT_TOKEN)
  const channel = str(env.EXPORT_SLACK_CHANNEL)
  if (botToken === null || channel === null) return null
  const teamUrl = str(env.EXPORT_SLACK_TEAM_URL)
  return {
    botToken,
    channel,
    ...(teamUrl === null ? {} : { teamUrl: teamUrl.replace(/\/+$/, '') }),
  }
}

export const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage'

/** The slice of Slack's `chat.postMessage` response this adapter reads. */
interface SlackPostMessageResponse {
  readonly ok?: boolean
  readonly ts?: unknown
  readonly channel?: unknown
  readonly error?: unknown
}

const REQUEST_TIMEOUT_MS = 10_000

export class SlackExportTarget implements ExportTargetPort {
  readonly target = 'slack' as const
  private readonly config: SlackExportConfig | null

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.config = readSlackExportConfig(env)
  }

  /** Configured-only availability: no probe request, just "is every env var present" (cheap). */
  available(): Promise<boolean> {
    return Promise.resolve(this.config !== null)
  }

  async send(item: ExportItem): Promise<ExportResult> {
    const config = this.config
    if (config === null) {
      throw new ExportUnavailableError('slack', 'slack export is not configured')
    }
    const text =
      item.body === undefined || item.body === '' ? item.title : `${item.title}\n${item.body}`
    try {
      const res = await this.fetchImpl(SLACK_POST_MESSAGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel: config.channel, text }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { ok: false, error: `slack responded ${String(res.status)}` }
      }
      const payload = (await res.json()) as SlackPostMessageResponse
      // Slack's Web API reports failure as HTTP 200 with `{ok:false, error}` — a failed send.
      if (payload.ok !== true) {
        const reason = typeof payload.error === 'string' ? payload.error : 'unknown error'
        return { ok: false, error: `slack error: ${reason}` }
      }
      const ts = payload.ts
      if (typeof ts !== 'string' || ts === '') {
        return { ok: false, error: 'slack response is missing the message ts' }
      }
      const channel = typeof payload.channel === 'string' ? payload.channel : config.channel
      // Archive permalink (only when the team URL is configured): {team}/archives/{channel}/p{ts-without-dot}.
      const url =
        config.teamUrl === undefined
          ? undefined
          : `${config.teamUrl}/archives/${channel}/p${ts.replace('.', '')}`
      return { ok: true, externalId: ts, ...(url === undefined ? {} : { url }) }
    } catch (err) {
      return {
        ok: false,
        error: `slack request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }
  }
}
