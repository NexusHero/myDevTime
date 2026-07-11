import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * The connector token crypto backend (M3, ADR-0032) — the ONLY place node `crypto`
 * is touched. Tokens are sealed with **envelope encryption + AEAD**: each record
 * gets a fresh random data key, the token is encrypted under it with AES-256-GCM,
 * and the data key itself is wrapped under a master key (from the environment/KMS,
 * never source). Persisted: ciphertext + wrapped data key + nonces + auth tags —
 * **plaintext is never stored**, and any tampering fails the GCM auth check on open.
 */
const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const NONCE_LEN = 12

export interface SealedToken {
  /** Base64 AES-GCM ciphertext of the token. */
  readonly ciphertext: string
  readonly nonce: string
  readonly authTag: string
  /** Base64 AES-GCM ciphertext of the per-record data key, under the master key. */
  readonly wrappedKey: string
  readonly keyNonce: string
  readonly keyAuthTag: string
}

function encrypt(key: Buffer, plaintext: Buffer): { ct: Buffer; nonce: Buffer; tag: Buffer } {
  const nonce = randomBytes(NONCE_LEN)
  const cipher = createCipheriv(ALG, key, nonce)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { ct, nonce, tag: cipher.getAuthTag() }
}

function decrypt(key: Buffer, ct: Buffer, nonce: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALG, key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/** Normalise a master key (base64, hex, or raw utf-8) to exactly 32 bytes. */
export function normaliseMasterKey(raw: string): Buffer {
  for (const enc of ['base64', 'hex'] as const) {
    try {
      const buf = Buffer.from(raw, enc)
      if (buf.length === KEY_LEN) return buf
    } catch {
      // try the next encoding
    }
  }
  const utf8 = Buffer.from(raw, 'utf8')
  if (utf8.length === KEY_LEN) return utf8
  throw new Error('CONNECTOR_MASTER_KEY must be 32 bytes (base64, hex, or raw)')
}

/** Seal a token: fresh data key, AEAD-encrypt the token, wrap the data key. */
export function sealToken(masterKey: Buffer, token: string): SealedToken {
  const dataKey = randomBytes(KEY_LEN)
  const body = encrypt(dataKey, Buffer.from(token, 'utf8'))
  const wrap = encrypt(masterKey, dataKey)
  return {
    ciphertext: body.ct.toString('base64'),
    nonce: body.nonce.toString('base64'),
    authTag: body.tag.toString('base64'),
    wrappedKey: wrap.ct.toString('base64'),
    keyNonce: wrap.nonce.toString('base64'),
    keyAuthTag: wrap.tag.toString('base64'),
  }
}

/** Open a sealed token: unwrap the data key, then decrypt. Throws on tamper/wrong key. */
export function openToken(masterKey: Buffer, sealed: SealedToken): string {
  const b64 = (s: string): Buffer => Buffer.from(s, 'base64')
  const dataKey = decrypt(
    masterKey,
    b64(sealed.wrappedKey),
    b64(sealed.keyNonce),
    b64(sealed.keyAuthTag),
  )
  const plaintext = decrypt(dataKey, b64(sealed.ciphertext), b64(sealed.nonce), b64(sealed.authTag))
  return plaintext.toString('utf8')
}
