import { describe, expect, it } from 'vitest'
import { SLACK_POST_MESSAGE_URL, SlackExportTarget, readSlackExportConfig } from './slack-target.js'
import { ExportUnavailableError, type ExportItem } from './port.js'

/**
 * The Slack adapter against an injected fake fetch (REQ-035, #44 · ADR-0035) — the wire shape
 * (URL/method/Bearer token/channel+text body), the success mapping (`ts` as external id, archive
 * permalink only with a team URL), the 200-with-`{ok:false}` failure convention, network failure
 * as `{ok:false}` (never thrown uncaught), and env-driven availability. No real network calls ever.
 */

const env: NodeJS.ProcessEnv = {
  EXPORT_SLACK_BOT_TOKEN: 'xoxb-test-token',
  EXPORT_SLACK_CHANNEL: 'C012AB3CD',
}

const item = (over: Partial<ExportItem> = {}): ExportItem => ({
  dedupeKey: 'meeting:1:action:0',
  title: 'Ship the report',
  confirmed: true,
  ...over,
})

interface Seen {
  url: string
  init: RequestInit
}

const jsonFetch =
  (status: number, body: unknown, seen: Seen[]): typeof fetch =>
  (input: unknown, init?: RequestInit) => {
    seen.push({ url: String(input), init: init ?? {} })
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

const posted = { ok: true, ts: '1712345678.000100', channel: 'C012AB3CD' }

describe('readSlackExportConfig', () => {
  it('ReturnsNullWhenAnyRequiredVarIsMissing', () => {
    expect(readSlackExportConfig({})).toBeNull()
    expect(readSlackExportConfig({ EXPORT_SLACK_BOT_TOKEN: 'x' })).toBeNull()
    expect(readSlackExportConfig({ ...env, EXPORT_SLACK_CHANNEL: '' })).toBeNull()
  })

  it('TeamUrlIsOptional_AndStripped', () => {
    expect(readSlackExportConfig(env)?.teamUrl).toBeUndefined()
    expect(
      readSlackExportConfig({ ...env, EXPORT_SLACK_TEAM_URL: 'https://acme.slack.com/' })?.teamUrl,
    ).toBe('https://acme.slack.com')
  })
})

describe('SlackExportTarget', () => {
  it('Unconfigured_IsUnavailable_AndSendRefuses', async () => {
    const target = new SlackExportTarget({}, jsonFetch(200, posted, []))
    await expect(target.available()).resolves.toBe(false)
    await expect(target.send(item())).rejects.toBeInstanceOf(ExportUnavailableError)
  })

  it('Configured_IsAvailable', async () => {
    await expect(new SlackExportTarget(env, jsonFetch(200, posted, [])).available()).resolves.toBe(
      true,
    )
  })

  it('PostsTheMessage_WithBearerTokenChannelAndText', async () => {
    const seen: Seen[] = []
    const target = new SlackExportTarget(env, jsonFetch(200, posted, seen))

    await target.send(item({ body: 'Details of the action item' }))

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe(SLACK_POST_MESSAGE_URL)
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer xoxb-test-token')
    expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(seen[0]?.init.body as string)).toEqual({
      channel: 'C012AB3CD',
      text: 'Ship the report\nDetails of the action item',
    })
  })

  it('TextIsTheTitleAlone_WhenTheItemHasNoBody', async () => {
    const seen: Seen[] = []
    await new SlackExportTarget(env, jsonFetch(200, posted, seen)).send(item())
    expect(JSON.parse(seen[0]?.init.body as string)).toEqual({
      channel: 'C012AB3CD',
      text: 'Ship the report',
    })
  })

  it('MapsTheMessageTs_ToExternalId_WithoutUrlByDefault', async () => {
    const target = new SlackExportTarget(env, jsonFetch(200, posted, []))
    await expect(target.send(item())).resolves.toEqual({
      ok: true,
      externalId: '1712345678.000100',
    })
  })

  it('BuildsTheArchivePermalink_WhenTheTeamUrlIsConfigured', async () => {
    const target = new SlackExportTarget(
      { ...env, EXPORT_SLACK_TEAM_URL: 'https://acme.slack.com' },
      jsonFetch(200, posted, []),
    )
    await expect(target.send(item())).resolves.toEqual({
      ok: true,
      externalId: '1712345678.000100',
      url: 'https://acme.slack.com/archives/C012AB3CD/p1712345678000100',
    })
  })

  it('OkFalse_IsAFailedResult_EvenOnHttp200', async () => {
    const target = new SlackExportTarget(
      env,
      jsonFetch(200, { ok: false, error: 'channel_not_found' }, []),
    )
    const result = await target.send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('channel_not_found')
  })

  it('HttpError_IsAFailedResult_NotAThrow', async () => {
    const result = await new SlackExportTarget(env, jsonFetch(503, {}, [])).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('503')
  })

  it('NetworkError_IsAFailedResult_NotAThrow', async () => {
    const failing = (() => Promise.reject(new Error('socket hang up'))) as unknown as typeof fetch
    const result = await new SlackExportTarget(env, failing).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('socket hang up')
  })
})
