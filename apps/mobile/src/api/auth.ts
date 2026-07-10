import { ApiError, getJson, postJson } from './http.js'
import { record, str } from './parse.js'

/**
 * The client auth seam (REQ-002, ADR-0007/0017/0018). The rest of the app talks to
 * auth only through here: the server's vendor-free `/api/auth/me` for "who am I",
 * and Better-Auth's `/api/auth/sign-in/email` · `/sign-out` for the transitions
 * (Better-Auth's wire format lives only behind this file — nothing upstream sees
 * it). Sign-in refetches `/me` so the identity we surface is always the
 * vendor-free `AuthUser`, never a Better-Auth session object.
 */
export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
}

export interface Credentials {
  readonly email: string
  readonly password: string
}

/** Parse the vendor-free identity from `/api/auth/me`, throwing on the wrong shape. */
export function parseUser(value: unknown): AuthUser {
  const o = record(value)
  return {
    id: str(o, 'id'),
    email: str(o, 'email'),
    emailVerified: o.emailVerified === true,
    name: typeof o.name === 'string' ? o.name : '',
  }
}

/** The current session's user, or `null` when signed out (a 401 on `/me`). */
export async function getSession(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthUser | null> {
  try {
    return parseUser(await getJson(baseUrl, '/api/auth/me', fetchImpl))
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return null
    throw cause
  }
}

/** Sign in with email + password, then return the vendor-free identity. */
export async function signIn(
  baseUrl: string,
  creds: Credentials,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthUser> {
  await postJson(baseUrl, '/api/auth/sign-in/email', creds, fetchImpl)
  const user = await getSession(baseUrl, fetchImpl)
  if (user === null) throw new ApiError(401, 'Sign-in failed', 'No session was established.')
  return user
}

/** End the current session. */
export async function signOut(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await postJson(baseUrl, '/api/auth/sign-out', {}, fetchImpl)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Pre-flight credential check. Returns a user-facing message, or `null` when valid. */
export function validateCredentials(creds: Credentials): string | null {
  if (!EMAIL_RE.test(creds.email)) return 'Enter a valid email address.'
  if (creds.password.length < 8) return 'Password must be at least 8 characters.'
  return null
}
