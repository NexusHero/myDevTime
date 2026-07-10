/**
 * The client HTTP seam (issue #11, ADR-0025 server): a thin credentialed JSON GET
 * plus the RFC 7807 → `ApiError` mapping the NestJS API speaks (`problem+json`).
 * `problemToError` is pure and tested; `getJson` is the only place the app talks
 * to `fetch`, so feature modules depend on typed results, not the network.
 */

/** A failed API call, carrying the server's problem title/detail and HTTP status. */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail: string | undefined

  constructor(status: number, title: string, detail?: string) {
    super(detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
  }
}

/** Map a non-2xx response body (problem+json, or anything) to an `ApiError`. Pure. */
export function problemToError(status: number, body: unknown): ApiError {
  if (body !== null && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title : `HTTP ${String(status)}`
    const detail = typeof record.detail === 'string' ? record.detail : undefined
    return new ApiError(status, title, detail)
  }
  return new ApiError(status, `HTTP ${String(status)}`)
}

/**
 * Send a request and read its JSON body, sending credentials (the Better-Auth
 * session cookie). Throws `ApiError` on a network failure, a non-2xx (mapped from
 * problem+json), or an unparseable 2xx. The single seam both `getJson` and
 * `postJson` build on; `fetchImpl` is injectable so it runs without a network.
 */
async function send(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<unknown> {
  let res: Response
  try {
    res = await fetchImpl(url, init)
  } catch (cause) {
    throw new ApiError(0, 'Network error', cause instanceof Error ? cause.message : undefined)
  }
  const text = await res.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      if (res.ok) throw new ApiError(res.status, 'Malformed response')
    }
  }
  if (!res.ok) throw problemToError(res.status, body)
  return body
}

/** GET `path` from `baseUrl` as JSON. See `send`. */
export async function getJson(
  baseUrl: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return send(
    `${baseUrl}${path}`,
    { method: 'GET', credentials: 'include', headers: { accept: 'application/json' } },
    fetchImpl,
  )
}

/** POST `body` as JSON to `path` on `baseUrl` and read the JSON response. See `send`. */
export async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return send(
    `${baseUrl}${path}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    },
    fetchImpl,
  )
}

/**
 * Wrap a `fetch` so a request that stalls longer than `ms` is aborted (`fetch`
 * has no default timeout — a black-holed connection hangs forever otherwise). The
 * abort surfaces through `send` as a network `ApiError`, so callers on the critical
 * path (e.g. the session probe) fall through instead of blocking the UI.
 */
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, ms)
    return fetchImpl(url, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer)
    })
  }) as typeof fetch
}
