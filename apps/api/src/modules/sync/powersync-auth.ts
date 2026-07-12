import { SignJWT, calculateJwkThumbprint, importJWK, type JWK } from 'jose'

/**
 * PowerSync client authentication (ADR-0043). PowerSync opens the device's sync
 * stream with a JWT our backend mints; the self-hosted service validates it
 * against our JWKS (`infra/powersync/powersync.yaml` → `PS_JWKS_URI`). The token
 * is short-lived and carries the `workspace_id` claim the sync rules filter by, so
 * a device can only ever stream its own workspace (isolation by construction).
 *
 * The signing key is provided as a JWK JSON string in config; the module is a
 * no-op (returns `null`) when it is unset, so the feature is off until an operator
 * configures a key. Only this file touches the crypto vendor (`jose`).
 */

/** The audience PowerSync's `client_auth` is configured to require. */
export const POWERSYNC_AUDIENCE = 'powersync'
/** Tokens are short-lived; the client refreshes them (PowerSync re-requests). */
export const DEFAULT_TTL_SECONDS = 300

type SigningKey = Awaited<ReturnType<typeof importJWK>>

export interface PowerSyncKeys {
  readonly alg: string
  readonly kid: string
  readonly privateKey: SigningKey
  /** The public half, published at the JWKS endpoint. */
  readonly publicJwk: JWK
}

/** The JWS algorithm implied by a key's type (RSA → RS256, OKP → EdDSA, EC → ES256). */
function algForKey(jwk: JWK): string {
  switch (jwk.kty) {
    case 'RSA':
      return 'RS256'
    case 'OKP':
      return 'EdDSA'
    case 'EC':
      return 'ES256'
    default:
      throw new Error(`powersync auth: unsupported key type ${String(jwk.kty)}`)
  }
}

/** Drop the private members so a private JWK becomes its publishable public JWK. */
function toPublicJwk(jwk: JWK): JWK {
  // RSA: d,p,q,dp,dq,qi · EC/OKP: d
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...pub } = jwk
  return pub
}

/**
 * Load the signing key from a private-JWK JSON string, or `null` when unset
 * (feature off). Derives the algorithm from the key type and the `kid` from the
 * JWK's own `kid` or its RFC 7638 thumbprint.
 */
export async function loadPowerSyncKeys(
  jwkJson: string | undefined,
): Promise<PowerSyncKeys | null> {
  if (!jwkJson) return null
  const jwk = JSON.parse(jwkJson) as JWK
  const alg = algForKey(jwk)
  const privateKey = await importJWK(jwk, alg)
  const kid = jwk.kid ?? (await calculateJwkThumbprint(jwk))
  const publicJwk: JWK = { ...toPublicJwk(jwk), kid, alg, use: 'sig' }
  return { alg, kid, privateKey, publicJwk }
}

export interface MintTokenInput {
  readonly userId: string
  readonly workspaceId: string
  readonly issuer: string
  readonly ttlSeconds?: number
  /** Injectable clock (epoch seconds) for deterministic tests; defaults to now. */
  readonly nowSeconds?: number
}

/** Mint a short-lived PowerSync device token for one user + workspace. */
export async function mintPowerSyncToken(
  keys: PowerSyncKeys,
  input: MintTokenInput,
): Promise<string> {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS
  return new SignJWT({ workspace_id: input.workspaceId })
    .setProtectedHeader({ alg: keys.alg, kid: keys.kid })
    .setSubject(input.userId)
    .setIssuer(input.issuer)
    .setAudience(POWERSYNC_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(keys.privateKey)
}

/** The JWKS document to publish (the public key, keyed by `kid`). */
export function powerSyncJwks(keys: PowerSyncKeys): { keys: readonly JWK[] } {
  return { keys: [keys.publicJwk] }
}
