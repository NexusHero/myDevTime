import { describe, expect, it } from 'vitest'
import { JiraExportTarget, readJiraExportConfig } from './jira-target.js'
import { ExportUnavailableError, type ExportItem } from './port.js'

/**
 * The Jira Cloud adapter against an injected fake fetch (REQ-035, #44 · ADR-0035) — the wire
 * shape (URL/method/basic auth/ADF body), the success mapping (issue key + browse URL), the
 * failure semantics (HTTP error and network error return `{ok:false}`, never throw uncaught),
 * and env-driven availability. No real network calls ever.
 */

const env: NodeJS.ProcessEnv = {
  EXPORT_JIRA_BASE_URL: 'https://acme.atlassian.net',
  EXPORT_JIRA_EMAIL: 'dev@acme.test',
  EXPORT_JIRA_API_TOKEN: 'jira-token',
  EXPORT_JIRA_PROJECT_KEY: 'DEV',
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

describe('readJiraExportConfig', () => {
  it('ReturnsNullWhenAnyRequiredVarIsMissing', () => {
    expect(readJiraExportConfig({})).toBeNull()
    expect(readJiraExportConfig({ ...env, EXPORT_JIRA_API_TOKEN: '' })).toBeNull()
    expect(readJiraExportConfig({ ...env, EXPORT_JIRA_PROJECT_KEY: undefined })).toBeNull()
  })

  it('DefaultsIssueTypeToTask_AndStripsTrailingSlash', () => {
    const config = readJiraExportConfig({
      ...env,
      EXPORT_JIRA_BASE_URL: `${env.EXPORT_JIRA_BASE_URL ?? ''}/`,
    })
    expect(config?.issueType).toBe('Task')
    expect(config?.baseUrl).toBe('https://acme.atlassian.net')
  })
})

describe('JiraExportTarget', () => {
  it('Unconfigured_IsUnavailable_AndSendRefuses', async () => {
    const target = new JiraExportTarget({}, jsonFetch(200, {}, []))
    await expect(target.available()).resolves.toBe(false)
    await expect(target.send(item())).rejects.toBeInstanceOf(ExportUnavailableError)
  })

  it('Configured_IsAvailable', async () => {
    await expect(new JiraExportTarget(env, jsonFetch(200, {}, [])).available()).resolves.toBe(true)
  })

  it('PostsTheIssue_WithBasicAuthAndAdfDescription', async () => {
    const seen: Seen[] = []
    const target = new JiraExportTarget(env, jsonFetch(201, { key: 'DEV-7' }, seen))

    await target.send(item({ body: 'Details of the action item' }))

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe('https://acme.atlassian.net/rest/api/3/issue')
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('dev@acme.test:jira-token').toString('base64')}`,
    )
    expect(headers['Content-Type']).toBe('application/json')
    expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(seen[0]?.init.body as string) as {
      fields: {
        project: { key: string }
        summary: string
        issuetype: { name: string }
        description: { type: string; version: number; content: unknown[] }
      }
    }
    expect(body.fields.project.key).toBe('DEV')
    expect(body.fields.summary).toBe('Ship the report')
    expect(body.fields.issuetype.name).toBe('Task')
    expect(body.fields.description).toEqual({
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Details of the action item' }] },
      ],
    })
  })

  it('OmitsTheDescription_WhenTheItemHasNoBody_AndHonorsTheIssueTypeVar', async () => {
    const seen: Seen[] = []
    const target = new JiraExportTarget(
      { ...env, EXPORT_JIRA_ISSUE_TYPE: 'Bug' },
      jsonFetch(201, { key: 'DEV-8' }, seen),
    )
    await target.send(item())
    const body = JSON.parse(seen[0]?.init.body as string) as { fields: Record<string, unknown> }
    expect(body.fields.description).toBeUndefined()
    expect(body.fields.issuetype).toEqual({ name: 'Bug' })
  })

  it('MapsTheCreatedIssue_ToExternalIdAndBrowseUrl', async () => {
    const target = new JiraExportTarget(env, jsonFetch(201, { key: 'DEV-7' }, []))
    await expect(target.send(item())).resolves.toEqual({
      ok: true,
      externalId: 'DEV-7',
      url: 'https://acme.atlassian.net/browse/DEV-7',
    })
  })

  it('HttpError_IsAFailedResult_NotAThrow', async () => {
    const target = new JiraExportTarget(env, jsonFetch(400, { errors: {} }, []))
    const result = await target.send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('400')
  })

  it('MissingIssueKey_IsAFailedResult', async () => {
    const result = await new JiraExportTarget(env, jsonFetch(201, {}, [])).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('issue key')
  })

  it('NetworkError_IsAFailedResult_NotAThrow', async () => {
    const failing = (() => Promise.reject(new Error('socket hang up'))) as unknown as typeof fetch
    const result = await new JiraExportTarget(env, failing).send(item())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('socket hang up')
  })
})
