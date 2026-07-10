import { describe, expect, it } from 'vitest'
import { ApiError, postJson, problemToError, withTimeout } from './http.js'

/**
 * The problem→error mapping is the client's read of the API's RFC 7807 contract,
 * so it is pinned: a well-formed problem+json body surfaces its title/detail,
 * while a missing or non-object body falls back to a status-derived message.
 */
describe('problemToError', () => {
  it('ProblemJson_WithTitleAndDetail_SurfacesBoth', () => {
    const err = problemToError(401, { title: 'Unauthorized', status: 401, detail: 'no session' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(err.title).toBe('Unauthorized')
    expect(err.detail).toBe('no session')
    expect(err.message).toBe('no session')
  })

  it('ProblemJson_TitleOnly_MessageIsTitle', () => {
    const err = problemToError(404, { title: 'Not Found', status: 404 })
    expect(err.title).toBe('Not Found')
    expect(err.detail).toBeUndefined()
    expect(err.message).toBe('Not Found')
  })

  it('NonObjectBody_FallsBackToStatusMessage', () => {
    expect(problemToError(500, null).title).toBe('HTTP 500')
    expect(problemToError(503, 'oops').title).toBe('HTTP 503')
  })
})

/**
 * `postJson` is the write counterpart of `getJson`: it sends a JSON body with the
 * session cookie and maps a non-2xx problem+json body to `ApiError`, exactly like
 * the read path, so the two seams behave identically on failure.
 */
describe('postJson', () => {
  function fetchReturning(
    status: number,
    body: unknown,
  ): {
    fetchImpl: typeof fetch
    seen: { url: string; init: RequestInit }[]
  } {
    const seen: { url: string; init: RequestInit }[] = []
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seen.push({ url, init: init ?? {} })
      const text = body === undefined ? '' : JSON.stringify(body)
      return Promise.resolve(new Response(text, { status }))
    }) as unknown as typeof fetch
    return { fetchImpl, seen }
  }

  it('SendsJsonBodyWithCredentials_AndParsesResponse', async () => {
    const { fetchImpl, seen } = fetchReturning(201, { id: 'e1' })
    const body = await postJson('http://api', '/x', { a: 1 }, fetchImpl)
    expect(body).toEqual({ id: 'e1' })
    expect(seen[0]?.url).toBe('http://api/x')
    expect(seen[0]?.init.method).toBe('POST')
    expect(seen[0]?.init.credentials).toBe('include')
    expect(seen[0]?.init.body).toBe(JSON.stringify({ a: 1 }))
    expect((seen[0]?.init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    )
  })

  it('Non2xx_ThrowsApiErrorFromProblem', async () => {
    const { fetchImpl } = fetchReturning(409, { title: 'Conflict', detail: 'already running' })
    await expect(postJson('http://api', '/x', {}, fetchImpl)).rejects.toMatchObject({
      status: 409,
      title: 'Conflict',
      detail: 'already running',
    })
  })

  it('NetworkFailure_ThrowsStatusZero', async () => {
    const fetchImpl = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
    await expect(postJson('http://api', '/x', {}, fetchImpl)).rejects.toMatchObject({
      status: 0,
      title: 'Network error',
    })
  })
})

/**
 * `withTimeout` guards a `fetch` that would otherwise hang forever (no default
 * timeout): a stalled request aborts, a prompt one passes straight through.
 */
describe('withTimeout', () => {
  it('StalledRequest_IsAborted', async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })) as unknown as typeof fetch
    await expect(withTimeout(hanging, 10)('http://x')).rejects.toThrow(/abort/i)
  })

  it('PromptResponse_PassesThrough', async () => {
    const fast = (() =>
      Promise.resolve(new Response('ok', { status: 200 }))) as unknown as typeof fetch
    const res = await withTimeout(fast, 1000)('http://x')
    expect(res.status).toBe(200)
  })
})
