import { describe, expect, it } from 'vitest'
import { getSession, parseUser, signIn, signOut, validateCredentials } from './auth.js'

/**
 * The client auth seam talks to the server's vendor-free `/api/auth/me` and
 * Better-Auth's `/api/auth/sign-in/email` · `/sign-out` (ADR-0018 edge). These pin
 * the identity parse, that a 401 on `me` means "signed out" (not an error), that
 * sign-in refetches the vendor-free identity, and the pre-flight credential
 * validation — all through an injected fetch so no network is needed.
 */
const USER = { id: 'u1', email: 'dev@nexushero.io', emailVerified: true, name: 'Dev' }

function fetchSeq(
  handlers: ((url: string, init?: RequestInit) => { status: number; body?: unknown })[],
): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = []
  let i = 0
  const fetchImpl = ((url: string, init?: RequestInit) => {
    urls.push(url)
    const h = handlers[Math.min(i, handlers.length - 1)]!
    i += 1
    const { status, body } = h(url, init)
    const text = body === undefined ? '' : JSON.stringify(body)
    return Promise.resolve(new Response(text, { status }))
  }) as unknown as typeof fetch
  return { fetchImpl, urls }
}

describe('parseUser', () => {
  it('ReadsIdentityFields', () => {
    const u = parseUser(USER)
    expect(u).toEqual({ id: 'u1', email: 'dev@nexushero.io', emailVerified: true, name: 'Dev' })
  })
  it('MissingName_DefaultsEmpty', () => {
    expect(parseUser({ id: 'u1', email: 'a@b.co', emailVerified: false }).name).toBe('')
  })
  it('MalformedPayload_Throws', () => {
    expect(() => parseUser({ email: 'a@b.co' })).toThrow()
  })
})

describe('getSession', () => {
  it('AuthenticatedMe_ReturnsUser', async () => {
    const { fetchImpl } = fetchSeq([() => ({ status: 200, body: USER })])
    expect((await getSession('http://api', fetchImpl))?.id).toBe('u1')
  })
  it('Unauthorized_ReturnsNull', async () => {
    const { fetchImpl } = fetchSeq([() => ({ status: 401, body: { title: 'Unauthorized' } })])
    expect(await getSession('http://api', fetchImpl)).toBeNull()
  })
  it('ServerError_Throws', async () => {
    const { fetchImpl } = fetchSeq([() => ({ status: 500, body: { title: 'Boom' } })])
    await expect(getSession('http://api', fetchImpl)).rejects.toMatchObject({ status: 500 })
  })
})

describe('signIn', () => {
  it('PostsCredentialsThenReturnsVendorFreeIdentity', async () => {
    const { fetchImpl, urls } = fetchSeq([
      () => ({ status: 200, body: { ok: true } }), // sign-in
      () => ({ status: 200, body: USER }), // /me
    ])
    const user = await signIn(
      'http://api',
      { email: 'dev@nexushero.io', password: 'hunter2xy' },
      fetchImpl,
    )
    expect(user.id).toBe('u1')
    expect(urls[0]).toContain('/api/auth/sign-in/email')
    expect(urls[1]).toContain('/api/auth/me')
  })
  it('NoSessionAfterSignIn_Throws', async () => {
    const { fetchImpl } = fetchSeq([
      () => ({ status: 200, body: { ok: true } }),
      () => ({ status: 401, body: { title: 'Unauthorized' } }),
    ])
    await expect(
      signIn('http://api', { email: 'dev@nexushero.io', password: 'hunter2xy' }, fetchImpl),
    ).rejects.toMatchObject({ status: 401 })
  })
})

describe('signOut', () => {
  it('PostsToSignOut', async () => {
    const { fetchImpl, urls } = fetchSeq([() => ({ status: 200, body: { ok: true } })])
    await signOut('http://api', fetchImpl)
    expect(urls[0]).toContain('/api/auth/sign-out')
  })
})

describe('validateCredentials', () => {
  it('ValidPair_IsNull', () => {
    expect(validateCredentials({ email: 'a@b.co', password: 'longenough' })).toBeNull()
  })
  it('BadEmail_IsRejected', () => {
    expect(validateCredentials({ email: 'nope', password: 'longenough' })).toMatch(/email/i)
  })
  it('ShortPassword_IsRejected', () => {
    expect(validateCredentials({ email: 'a@b.co', password: 'short' })).toMatch(/8/)
  })
})
