import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { signState, verifyState } from './crypto.js'
import {
  clientSecretEnvKey,
  exchangeAuthorizationCode,
  freshAccessToken,
  masterKeyFromEnv,
  oauthClient,
  preserveRefreshToken,
  redirectUriFor,
  refreshAccessToken,
  tokenEndpoint,
  type OAuthTokenSet,
  type TokenStore,
} from './oauth.js'

/**
 * The OAuth code/refresh exchange (REQ-010, #15). Everything is proven against a fake fetch — no
 * network — plus the env-gating helpers and the freshness/refresh logic of `freshAccessToken`. A
 * plaintext token never leaves the flow; the vendor wire JSON stays confined to `oauth.ts`.
 */
interface Seen {
  url: string
  method: string | undefined
  body: string | undefined
}

const jsonFetch = (status: number, body: unknown, seen: Seen[]): typeof fetch =>
  ((url: string, init?: RequestInit) => {
    seen.push({ url, method: init?.method, body: init?.body as string | undefined })
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }) as unknown as typeof fetch

const GOOGLE = 'https://oauth2.googleapis.com/token'

describe('env gating', () => {
  it('TokenEndpoint_KnownForGoogle_NullOtherwise', () => {
    expect(tokenEndpoint('google-calendar')).toBe(GOOGLE)
  })

  it('ClientSecretEnvKey_MirrorsClientIdKey', () => {
    expect(clientSecretEnvKey('google-calendar')).toBe('CONNECTOR_GOOGLE_CALENDAR_CLIENT_SECRET')
  })

  it('OAuthClient_NullUntilBothIdAndSecretSet', () => {
    expect(oauthClient('google-calendar', {})).toBeNull()
    expect(oauthClient('google-calendar', { CONNECTOR_GOOGLE_CALENDAR_CLIENT_ID: 'id' })).toBeNull()
    expect(
      oauthClient('google-calendar', {
        CONNECTOR_GOOGLE_CALENDAR_CLIENT_ID: 'id',
        CONNECTOR_GOOGLE_CALENDAR_CLIENT_SECRET: 'sec',
      }),
    ).toEqual({ clientId: 'id', clientSecret: 'sec' })
  })

  it('RedirectUri_FromDedicatedBaseOrAuthBase_NullWhenNeither', () => {
    expect(redirectUriFor('google-calendar', {})).toBeNull()
    expect(redirectUriFor('google-calendar', { AUTH_BASE_URL: 'https://app.example.com/' })).toBe(
      'https://app.example.com/api/connectors/google-calendar/callback',
    )
    expect(
      redirectUriFor('google-calendar', {
        CONNECTOR_REDIRECT_BASE_URL: 'https://api.example.com',
        AUTH_BASE_URL: 'https://ignored',
      }),
    ).toBe('https://api.example.com/api/connectors/google-calendar/callback')
  })

  it('MasterKeyFromEnv_NullWhenUnsetOrMalformed_BufferWhen32Bytes', () => {
    expect(masterKeyFromEnv({})).toBeNull()
    expect(masterKeyFromEnv({ CONNECTOR_MASTER_KEY: 'too-short' })).toBeNull()
    const key = randomBytes(32).toString('base64')
    const buf = masterKeyFromEnv({ CONNECTOR_MASTER_KEY: key })
    expect(buf).not.toBeNull()
    expect(buf?.length).toBe(32)
  })
})

describe('token exchange', () => {
  it('ExchangeAuthorizationCode_PostsGrant_AndMapsTokens', async () => {
    const seen: Seen[] = []
    const nowMs = 1_700_000_000_000
    const set = await exchangeAuthorizationCode(
      GOOGLE,
      { clientId: 'id', clientSecret: 'sec', code: 'abc', redirectUri: 'https://app/cb' },
      {
        fetchImpl: jsonFetch(
          200,
          { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'a b' },
          seen,
        ),
        nowMs: () => nowMs,
      },
    )
    expect(seen[0]?.url).toBe(GOOGLE)
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.body).toContain('grant_type=authorization_code')
    expect(seen[0]?.body).toContain('code=abc')
    expect(set.accessToken).toBe('AT')
    expect(set.refreshToken).toBe('RT')
    expect(set.expiresAt?.getTime()).toBe(nowMs + 3600 * 1000)
    expect(set.scopes).toEqual(['a', 'b'])
  })

  it('RefreshAccessToken_PostsRefreshGrant', async () => {
    const seen: Seen[] = []
    await refreshAccessToken(
      GOOGLE,
      { clientId: 'id', clientSecret: 'sec', refreshToken: 'RT' },
      { fetchImpl: jsonFetch(200, { access_token: 'AT2' }, seen) },
    )
    expect(seen[0]?.body).toContain('grant_type=refresh_token')
    expect(seen[0]?.body).toContain('refresh_token=RT')
  })

  it('Exchange_NonOk_ThrowsTokenExchangeError', async () => {
    const seen: Seen[] = []
    await expect(
      exchangeAuthorizationCode(
        GOOGLE,
        { clientId: 'id', clientSecret: 'sec', code: 'x', redirectUri: 'r' },
        { fetchImpl: jsonFetch(400, { error: 'invalid_grant' }, seen) },
      ),
    ).rejects.toThrow(/token endpoint responded 400/)
  })

  it('Exchange_UnexpectedShape_Throws', async () => {
    const seen: Seen[] = []
    await expect(
      exchangeAuthorizationCode(
        GOOGLE,
        { clientId: 'id', clientSecret: 'sec', code: 'x', redirectUri: 'r' },
        { fetchImpl: jsonFetch(200, { nope: true }, seen) },
      ),
    ).rejects.toThrow(/unexpected token response shape/)
  })
})

describe('freshAccessToken', () => {
  const provider = { endpoint: GOOGLE, clientId: 'id', clientSecret: 'sec' }
  const store = (
    loaded: Awaited<ReturnType<TokenStore['load']>>,
    saved: OAuthTokenSet[],
  ): TokenStore => ({
    load: () => Promise.resolve(loaded),
    save: input => {
      saved.push({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        expiresAt: input.expiresAt ?? null,
        scopes: input.scopes ?? [],
      })
      return Promise.resolve()
    },
  })

  it('NoStoredToken_ReturnsNull', async () => {
    expect(await freshAccessToken(store(null, []), provider)).toBeNull()
  })

  it('FreshToken_ReturnedWithoutRefresh', async () => {
    const now = 1_700_000_000_000
    const token = await freshAccessToken(
      store(
        { accessToken: 'AT', refreshToken: 'RT', expiresAt: new Date(now + 600_000), scopes: [] },
        [],
      ),
      provider,
      {
        nowMs: () => now,
        fetchImpl: (() => Promise.reject(new Error('should not fetch'))) as unknown as typeof fetch,
      },
    )
    expect(token).toBe('AT')
  })

  it('ExpiredToken_RefreshesAndSavesBack_PreservingRefreshToken', async () => {
    const now = 1_700_000_000_000
    const saved: OAuthTokenSet[] = []
    const seen: Seen[] = []
    const token = await freshAccessToken(
      store(
        { accessToken: 'old', refreshToken: 'RT', expiresAt: new Date(now - 1), scopes: ['s'] },
        saved,
      ),
      provider,
      { nowMs: () => now, fetchImpl: jsonFetch(200, { access_token: 'new' }, seen) },
    )
    expect(token).toBe('new')
    // Google omits the refresh token on refresh → the stored one is preserved.
    expect(saved[0]?.refreshToken).toBe('RT')
    expect(saved[0]?.accessToken).toBe('new')
  })

  it('ExpiredToken_NoRefreshToken_ReturnsNull', async () => {
    const now = 1_700_000_000_000
    const token = await freshAccessToken(
      store(
        { accessToken: 'old', refreshToken: null, expiresAt: new Date(now - 1), scopes: [] },
        [],
      ),
      provider,
      { nowMs: () => now },
    )
    expect(token).toBeNull()
  })
})

describe('preserveRefreshToken', () => {
  it('KeepsTheFreshTokenWhenTheProviderIssuesOne', () => {
    expect(preserveRefreshToken('new', 'old')).toBe('new')
  })

  it('FallsBackToTheStoredTokenWhenTheProviderOmitsIt', () => {
    // Google omits refresh_token on a repeat auth-code exchange — the stored one must survive.
    expect(preserveRefreshToken(null, 'old')).toBe('old')
  })

  it('IsNullOnlyWhenNeitherExists', () => {
    expect(preserveRefreshToken(null, null)).toBeNull()
  })
})

describe('OAuth state (crypto)', () => {
  const key = randomBytes(32)
  const claims = { userId: 'u1', connector: 'google-calendar' }

  it('SignThenVerify_RoundTrips', () => {
    const state = signState(key, claims)
    expect(verifyState(key, state)).toMatchObject(claims)
  })

  it('TamperedSignature_Rejected', () => {
    const state = signState(key, claims)
    expect(verifyState(key, `${state}x`)).toBeNull()
  })

  it('ForeignKey_Rejected', () => {
    const state = signState(key, claims)
    expect(verifyState(randomBytes(32), state)).toBeNull()
  })

  it('StaleState_Rejected', () => {
    const state = signState(key, claims, 1_000)
    expect(verifyState(key, state, { nowMs: 1_000 + 999_999_999, maxAgeMs: 60_000 })).toBeNull()
  })

  it('Malformed_Rejected', () => {
    expect(verifyState(key, 'not-a-state')).toBeNull()
    expect(verifyState(key, '')).toBeNull()
  })
})
