import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { normaliseMasterKey, openToken, sealToken } from './crypto.js'

/**
 * The connector token crypto (M3, ADR-0032): envelope encryption + AEAD. These pin
 * the round-trip, that plaintext never appears in the sealed record, tamper
 * detection, and that a wrong master key cannot open a token.
 */
const masterKey = randomBytes(32)

describe('sealToken / openToken', () => {
  it('RoundTripsATokenThroughSealAndOpen', () => {
    const token = 'gho_abc123-secret-refresh-token'
    const sealed = sealToken(masterKey, token)
    expect(openToken(masterKey, sealed)).toBe(token)
  })

  it('NeverStoresThePlaintextInTheSealedRecord', () => {
    const token = 'super-secret-value'
    const sealed = sealToken(masterKey, token)
    const blob = JSON.stringify(sealed)
    expect(blob).not.toContain(token)
    expect(blob).not.toContain('secret')
  })

  it('ProducesAFreshDataKeyEachTime', () => {
    // A long plaintext so the ciphertext comparison can't collide by chance (a
    // 1-byte payload has only 256 possible ciphertext bytes → 1/256 flake).
    const token = 'a-sufficiently-long-secret-token-value-0123456789'
    const a = sealToken(masterKey, token)
    const b = sealToken(masterKey, token)
    expect(a.wrappedKey).not.toBe(b.wrappedKey)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('FailsToOpenWhenTheCiphertextIsTampered', () => {
    const sealed = sealToken(masterKey, 'token')
    const tampered = { ...sealed, ciphertext: Buffer.from('evil').toString('base64') }
    expect(() => openToken(masterKey, tampered)).toThrow()
  })

  it('CannotBeOpenedWithADifferentMasterKey', () => {
    const sealed = sealToken(masterKey, 'token')
    expect(() => openToken(randomBytes(32), sealed)).toThrow()
  })
})

describe('normaliseMasterKey', () => {
  it('AcceptsA32ByteBase64Key', () => {
    const key = randomBytes(32).toString('base64')
    expect(normaliseMasterKey(key)).toHaveLength(32)
  })
  it('AcceptsA32ByteRawUtf8Key', () => {
    expect(normaliseMasterKey('0123456789abcdef0123456789abcdef')).toHaveLength(32)
  })
  it('RejectsAKeyOfTheWrongLength', () => {
    expect(() => normaliseMasterKey('too-short')).toThrow()
  })
})
