import { ApiError, getJson, postJson, withTimeout } from './http.js'
import { record, str } from './parse.js'

/** Default budget for the session probe before it falls through to the login gate. */
const SESSION_TIMEOUT_MS = 8000

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
  timeoutMs: number = SESSION_TIMEOUT_MS,
): Promise<AuthUser | null> {
  try {
    return parseUser(await getJson(baseUrl, '/api/auth/me', withTimeout(fetchImpl, timeoutMs)))
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

export type SocialProvider = 'google' | 'apple' | 'github'

/** Which sign-in methods this deployment offers (from `GET /api/auth/providers`). */
export interface AuthProviders {
  readonly emailPassword: boolean
  readonly social: readonly SocialProvider[]
}

export interface SignUpInput {
  readonly name: string
  readonly email: string
  readonly password: string
}

const SOCIAL: readonly SocialProvider[] = ['google', 'apple', 'github']
const isSocial = (v: unknown): v is SocialProvider => SOCIAL.includes(v as SocialProvider)

/** Parse the configured auth methods, defaulting conservatively on a bad shape. */
export function parseProviders(value: unknown): AuthProviders {
  const o = record(value)
  const social = Array.isArray(o.social) ? o.social.filter(isSocial) : []
  return { emailPassword: o.emailPassword === true, social }
}

/** Which sign-in methods are configured — the gate reads this to enable buttons. */
export async function fetchProviders(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthProviders> {
  return parseProviders(await getJson(baseUrl, '/api/auth/providers', fetchImpl))
}

/**
 * Create an account with name + email + password. Returns the signed-in identity
 * when the server established a session immediately, or `null` when email
 * verification is required first (production default) — the caller then tells the
 * user to check their inbox. The wire route is Better-Auth's `/sign-up/email`.
 */
export async function signUp(
  baseUrl: string,
  input: SignUpInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthUser | null> {
  await postJson(baseUrl, '/api/auth/sign-up/email', input, fetchImpl)
  return getSession(baseUrl, fetchImpl)
}

/**
 * Begin an OAuth sign-in: ask Better-Auth's `/sign-in/social` for the provider's
 * authorize URL (server round-trip so the client never holds client secrets), and
 * return it for the caller to open. `callbackURL` is where the provider returns to
 * after consent — our own origin, so the session cookie lands on us.
 */
export async function startSocialSignIn(
  baseUrl: string,
  provider: SocialProvider,
  callbackURL: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = record(
    await postJson(baseUrl, '/api/auth/sign-in/social', { provider, callbackURL }, fetchImpl),
  )
  return str(body, 'url')
}

/** Pre-flight sign-up check. Returns a user-facing message, or `null` when valid. */
export function validateSignUp(input: SignUpInput): string | null {
  if (input.name.trim().length === 0) return 'Enter your name.'
  return validateCredentials({ email: input.email, password: input.password })
}

/**
 * Ask the server to email a password-reset link (Better-Auth `/forget-password`).
 * Always resolves — the server does not reveal whether the address exists, so the
 * UI shows the same "check your inbox" either way.
 */
export async function requestPasswordReset(
  baseUrl: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await postJson(baseUrl, '/api/auth/forget-password', { email }, fetchImpl)
}
