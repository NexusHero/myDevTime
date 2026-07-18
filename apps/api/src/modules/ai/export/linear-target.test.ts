import { describe, expect, it } from 'vitest'
import { LINEAR_GRAPHQL_URL, LinearExportTarget, readLinearExportConfig } from './linear-target.js'
import { ExportUnavailableError, type ExportItem } from './port.js'

/**
 * The Linear adapter against an injected fake fetch (REQ-035, #44 · ADR-0035) — the GraphQL wire
 * shape (URL/method/Authorization/mutation input), the success mapping (identifier + url), the
 * 200-with-`errors`-array failure convention, network failure as `{ok:false}` (never thrown
 * uncaught), and env-driven availability. No real network calls ever.
 */

const env: NodeJS.ProcessEnv = {
  EXPORT_LINEAR_API_KEY: 'lin_api_key',
  EXPORT_LINEAR_TEAM_ID: 'team-123',
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

const created = (identifier: string, url: string): unknown => ({
  data: { issueCreate: { success: true, issue: { identifier, url } } },
})

describe('readLinearExportConfig', () => {
  it('ReturnsNullWhenAnyRequiredVarIsMissing', () => {
    expect(readLinearExportConfig({})).toBeNull()
    expect(readLinearExportConfig({ EXPORT_LINEAR_API_KEY: 'k' })).toBeNull()
    expect(readLinearExportConfig({ ...env, EXPORT_LINEAR_TEAM_ID: '' })).toBeNull()
  })
})

describe('LinearExportTarget', () => {
  it('Unconfigured_IsUnavailable_AndSendRefuses', async () => {
    const target = new LinearExportTarget({}, jsonFetch(200, {}, []))
    await expect(target.available()).resolves.toBe(false)
    await expect(target.send(item())).rejects.toBeInstanceOf(ExportUnavailableError)
  })

  it('Configured_IsAvailable', async () => {
    const target = new LinearExportTarget(env, jsonFetch(200, {}, []))
    await expect(target.available()).resolves.toBe(true)
  })

  it('PostsTheIssueCreateMutation_WithAuthAndInput', async () => {
    const seen: Seen[] = []
    const target = new LinearExportTarget(
      env,
      jsonFetch(200, created('MDT-9', 'https://linear.app/acme/issue/MDT-9'), seen),
    )

    await target.send(item({ body: 'Details of the action item' }))

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe(LINEAR_GRAPHQL_URL)
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('lin_api_key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(seen[0]?.init.body as string) as {
      query: string
      variables: { input: Record<string, unknown> }
    }
    expect(body.query).toContain('issueCreate(input: $input)')
    expect(body.variables.input).toEqual({
      teamId: 'team-123',
      title: 'Ship the report',
      description: 'Details of the action item',
    })
  })

  it('OmitsTheDescription_WhenTheItemHasNoBody', async () => {
    const seen: Seen[] = []
    const target = new LinearExportTarget(env, jsonFetch(200, created('MDT-9', 'u'), seen))
    await target.send(item())
    const body = JSON.parse(seen[0]?.init.body as string) as {
      variables: { input: Record<string, unknown> }
    }
    expect(body.variables.input).toEqual({ teamId: 'team-123', title: 'Ship the report' })
  })

  it('MapsTheCreatedIssue_ToExternalIdAndUrl', async () => {
    const target = new LinearExportTarget(
      env,
      jsonFetch(200, created('MDT-9', 'https://linear.app/acme/issue/MDT-9'), []),
    )
    await expect(target.send(item())).resolves.toEqual({
      ok: true,
      externalId: 'MDT-9',
      url: 'https://linear.app/acme/issue/MDT-9',
    })
  })

  it('GraphqlErrorsArray_IsAFailedResult', async () => {
    const target = new LinearExportTarget(
      env,
      jsonFetch(200, { errors: [{ message: 'team not found' }] }, []),
    )
    const result = await target.send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('team not found')
  })

  it('UnsuccessfulCreate_IsAFailedResult', async () => {
    const target = new LinearExportTarget(
      env,
      jsonFetch(200, { data: { issueCreate: { success: false, issue: null } } }, []),
    )
    const result = await target.send(item())
    expect(result.ok).toBe(false)
  })

  it('HttpError_IsAFailedResult_NotAThrow', async () => {
    const result = await new LinearExportTarget(env, jsonFetch(500, {}, [])).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('500')
  })

  it('NetworkError_IsAFailedResult_NotAThrow', async () => {
    const failing = (() => Promise.reject(new Error('socket hang up'))) as unknown as typeof fetch
    const result = await new LinearExportTarget(env, failing).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('socket hang up')
  })
})
