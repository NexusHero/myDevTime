import { describe, expect, it } from 'vitest'
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify } from 'jose'
import {
  loadPowerSyncKeys,
  mintPowerSyncToken,
  powerSyncJwks,
  POWERSYNC_AUDIENCE,
} from './powersync-auth.js'

/** A private-JWK JSON string for a fresh RS256 keypair (what config would hold). */
async function freshPrivateJwkJson(): Promise<string> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = await exportJWK(privateKey)
  return JSON.stringify({ ...jwk, alg: 'RS256' })
}

const ISSUER = 'https://api.mydevtime.test'

describe('powerSync auth', () => {
  it('LoadKeys_ReturnsNull_WhenUnconfigured', async () => {
    expect(await loadPowerSyncKeys(undefined)).toBeNull()
    expect(await loadPowerSyncKeys('')).toBeNull()
  })

  it('PublicJwk_HasNoPrivateMembers_AndCarriesKidAlgUse', async () => {
    const keys = await loadPowerSyncKeys(await freshPrivateJwkJson())
    expect(keys).not.toBeNull()
    const pub = keys!.publicJwk
    expect(pub.d).toBeUndefined() // private members stripped
    expect(pub.p).toBeUndefined()
    expect(pub.q).toBeUndefined()
    expect(pub.kid).toBe(keys!.kid)
    expect(pub.alg).toBe('RS256')
    expect(pub.use).toBe('sig')
  })

  it('MintedToken_VerifiesAgainstTheJwks_WithTheRightClaims', async () => {
    const keys = await loadPowerSyncKeys(await freshPrivateJwkJson())
    const token = await mintPowerSyncToken(keys!, {
      userId: 'user-1',
      workspaceId: 'ws-1',
      issuer: ISSUER,
      nowSeconds: 1_000_000,
      ttlSeconds: 300,
    })

    // Validate exactly how the PowerSync service would: against the published JWKS.
    const jwks = createLocalJWKSet(powerSyncJwks(keys!) as Parameters<typeof createLocalJWKSet>[0])
    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: POWERSYNC_AUDIENCE,
      currentDate: new Date(1_000_100 * 1000), // within the 300s window
    })

    expect(protectedHeader.kid).toBe(keys!.kid)
    expect(payload.sub).toBe('user-1')
    expect(payload.workspace_id).toBe('ws-1')
    expect(payload.aud).toBe(POWERSYNC_AUDIENCE)
    expect(payload.exp).toBe(1_000_300)
  })

  it('ExpiredToken_FailsVerification', async () => {
    const keys = await loadPowerSyncKeys(await freshPrivateJwkJson())
    const token = await mintPowerSyncToken(keys!, {
      userId: 'user-1',
      workspaceId: 'ws-1',
      issuer: ISSUER,
      nowSeconds: 1_000_000,
      ttlSeconds: 300,
    })
    const jwks = createLocalJWKSet(powerSyncJwks(keys!) as Parameters<typeof createLocalJWKSet>[0])
    await expect(
      jwtVerify(token, jwks, {
        issuer: ISSUER,
        audience: POWERSYNC_AUDIENCE,
        currentDate: new Date(1_000_400 * 1000), // past exp (1_000_300)
      }),
    ).rejects.toThrow()
  })
})
