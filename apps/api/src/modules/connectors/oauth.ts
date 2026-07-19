import { z } from 'zod'
import { AppError } from '../../errors.js'
import type { Db } from '../../db/client.js'
import { getToken, putToken, type StoreTokenInput } from './vault.js'
import { normaliseMasterKey } from './crypto.js'
import { clientIdEnvKey } from './service.js'
import type { ConnectorId } from './registry.js'

/**
 * OAuth 2.0 code/refresh exchange for connectors (REQ-010, #15; groundwork for
 * REQ-034, #43). Pure fetch against the provider's token endpoint — no SDK — and
 * the results go straight into the sealed vault; a plaintext token never leaves
 * this flow. The provider's wire JSON (`access_token`, `expires_in`, …) is
 * confined to this file (skill §2.2); upstream sees the neutral `OAuthTokenSet`.
 * Everything is env-gated: an unconfigured provider has no endpoint/secret and
 * the routes report that honestly instead of pretending.
 */

/**
 * Token endpoints for providers with a live exchange. Absent → flow not built yet.
 * Apple has NO OAuth calendar API (EventKit is native), so it is intentionally absent
 * here — `tokenEndpoint('apple-calendar')` stays null and its OAuth flow honestly
 * reports not-implemented.
 */
const TOKEN_ENDPOINT: Partial<Record<ConnectorId, string>> = {
  'google-calendar': 'https://oauth2.googleapis.com/token',
  'microsoft-calendar': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
}

export function tokenEndpoint(id: ConnectorId): string | null {
  return TOKEN_ENDPOINT[id] ?? null
}

/** The env var holding a provider's OAuth client secret (mirrors `clientIdEnvKey`). */
export function clientSecretEnvKey(id: ConnectorId): string {
  return `CONNECTOR_${id.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`
}

/**
 * The 32-byte vault master key from `CONNECTOR_MASTER_KEY` (base64/hex/raw), or
 * `null` when it is unset or malformed. `null` means "the vault cannot seal
 * tokens" — the OAuth routes turn that into an honest 409, never a silent
 * plaintext store.
 */
export function masterKeyFromEnv(env: Record<string, string | undefined>): Buffer | null {
  const raw = env.CONNECTOR_MASTER_KEY
  if (raw === undefined || raw.length === 0) return null
  try {
    return normaliseMasterKey(raw)
  } catch {
    return null
  }
}

/**
 * The redirect URI the provider sends the browser back to. The base origin comes
 * from config, never from a client-controlled header: `CONNECTOR_REDIRECT_BASE_URL`
 * (dedicated) or `AUTH_BASE_URL` (the deployed origin, per the handback doc).
 */
export function redirectUriFor(
  id: ConnectorId,
  env: Record<string, string | undefined>,
): string | null {
  const base = env.CONNECTOR_REDIRECT_BASE_URL ?? env.AUTH_BASE_URL
  if (base === undefined || base.length === 0) return null
  return `${base.replace(/\/+$/, '')}/api/connectors/${id}/callback`
}

/** The OAuth client credentials for a provider, or null when not fully configured. */
export function oauthClient(
  id: ConnectorId,
  env: Record<string, string | undefined>,
): { clientId: string; clientSecret: string } | null {
  const clientId = env[clientIdEnvKey(id)]
  const clientSecret = env[clientSecretEnvKey(id)]
  if (clientId === undefined || clientId.length === 0) return null
  if (clientSecret === undefined || clientSecret.length === 0) return null
  return { clientId, clientSecret }
}

/** 409 for flows that need configuration/connection state the deployment lacks. */
export class ConflictError extends AppError {
  constructor(detail?: string) {
    super({ status: 409, type: 'about:blank', title: 'Conflict', ...(detail ? { detail } : {}) })
  }
}

/** 502 when the provider's token endpoint refuses or is unreachable. */
export class TokenExchangeError extends AppError {
  constructor(detail?: string) {
    super({
      status: 502,
      type: 'about:blank',
      title: 'Bad Gateway',
      ...(detail ? { detail } : {}),
    })
  }
}

/** The neutral shape of a completed exchange — vault-ready, vendor-free. */
export interface OAuthTokenSet {
  readonly accessToken: string
  readonly refreshToken: string | null
  readonly expiresAt: Date | null
  readonly scopes: readonly string[]
}

/**
 * The refresh token to seal when re-authorizing: the freshly-issued one, or — when the provider
 * omits it (Google does not re-issue a refresh token on a repeat authorization-code exchange) —
 * the one already stored. Without this a reconnect/consent-change would overwrite a still-valid
 * refresh token with `null`, and once the access token expired the connection would silently
 * degrade to unavailable. `freshAccessToken` applies the same rule on its refresh path.
 */
export function preserveRefreshToken(fresh: string | null, stored: string | null): string | null {
  return fresh ?? stored
}

// The provider's wire shape (RFC 6749 §5.1) — confined to this file.
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
})

export interface OAuthIo {
  readonly fetchImpl?: typeof fetch
  readonly nowMs?: () => number
}

const EXCHANGE_TIMEOUT_MS = 10_000

async function postTokenRequest(
  endpoint: string,
  form: Record<string, string>,
  io: OAuthIo,
): Promise<OAuthTokenSet> {
  const fetchImpl = io.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
  } catch {
    throw new TokenExchangeError('token endpoint unreachable')
  }
  if (!res.ok) throw new TokenExchangeError(`token endpoint responded ${String(res.status)}`)
  const parsed = tokenResponseSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new TokenExchangeError('unexpected token response shape')
  const body = parsed.data
  const now = (io.nowMs ?? Date.now)()
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in === undefined ? null : new Date(now + body.expires_in * 1000),
    scopes: body.scope === undefined ? [] : body.scope.split(' ').filter(s => s.length > 0),
  }
}

/** Exchange an authorization code for tokens (RFC 6749 §4.1.3). */
export async function exchangeAuthorizationCode(
  endpoint: string,
  args: { clientId: string; clientSecret: string; code: string; redirectUri: string },
  io: OAuthIo = {},
): Promise<OAuthTokenSet> {
  return postTokenRequest(
    endpoint,
    {
      grant_type: 'authorization_code',
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
    },
    io,
  )
}

/** Exchange a refresh token for a fresh access token (RFC 6749 §6). */
export async function refreshAccessToken(
  endpoint: string,
  args: { clientId: string; clientSecret: string; refreshToken: string },
  io: OAuthIo = {},
): Promise<OAuthTokenSet> {
  return postTokenRequest(
    endpoint,
    {
      grant_type: 'refresh_token',
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
    },
    io,
  )
}

/** The narrow load/save seam `freshAccessToken` needs — the vault, or a test fake. */
export interface TokenStore {
  load(): Promise<{
    readonly accessToken: string
    readonly refreshToken: string | null
    readonly expiresAt: Date | null
    readonly scopes: readonly string[]
  } | null>
  save(input: StoreTokenInput): Promise<void>
}

/** Compose the sealed vault into a `TokenStore` for one (workspace, user, connector). */
export function vaultTokenStore(
  db: Db,
  masterKey: Buffer,
  key: { workspaceId: string; userId: string; connector: string },
): TokenStore {
  return {
    load: () => getToken(db, masterKey, key),
    save: input => putToken(db, masterKey, key, input),
  }
}

/** Refresh no earlier than this before expiry, so a token never dies mid-request. */
const EXPIRY_SKEW_MS = 30_000

/**
 * A live access token for the store's connector: the stored one while it is
 * fresh, otherwise a refresh-token exchange whose result is sealed back into the
 * store (preserving the refresh token when the provider omits it, as Google
 * does). `null` when nothing is stored or the token is expired with no refresh
 * token — the caller degrades, it never guesses.
 */
export async function freshAccessToken(
  store: TokenStore,
  provider: { endpoint: string; clientId: string; clientSecret: string },
  io: OAuthIo = {},
): Promise<string | null> {
  const stored = await store.load()
  if (stored === null) return null
  const now = (io.nowMs ?? Date.now)()
  if (stored.expiresAt === null || stored.expiresAt.getTime() - now > EXPIRY_SKEW_MS) {
    return stored.accessToken
  }
  if (stored.refreshToken === null) return null
  const refreshed = await refreshAccessToken(
    provider.endpoint,
    {
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      refreshToken: stored.refreshToken,
    },
    io,
  )
  await store.save({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? stored.refreshToken,
    expiresAt: refreshed.expiresAt,
    scopes: stored.scopes,
  })
  return refreshed.accessToken
}
