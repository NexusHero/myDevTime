import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { apiBaseUrl } from '../config.js'
import {
  fetchProviders,
  getSession,
  requestPasswordReset,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  startSocialSignIn,
  type AuthProviders,
  type AuthUser,
  type Credentials,
  type SignUpInput,
  type SocialProvider,
} from '../api/auth.js'

/**
 * The session for the auth gate (REQ-002). When an API base URL is configured it
 * loads `/api/auth/me`, reads which sign-in methods this deployment offers
 * (`/providers`), and drives sign-in / sign-up / social / sign-out through the auth
 * seam. With no backend — the default in local dev and the test gate — there is no
 * session (the app shows the login gate); the app fabricates no demo user. `live`
 * lets the UI tell the two apart.
 */
const OFFLINE = 'Connect a workspace to sign in — no backend is configured.'
const EMAIL_ONLY: AuthProviders = { emailPassword: true, social: [] }

/** Where the OAuth provider returns to after consent — our own origin on web. */
function callbackUrl(base: string): string {
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin
  return base
}

export interface SessionResource {
  readonly user: AuthUser | null
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly busy: boolean
  /** Which sign-in methods are configured (drives which buttons are enabled). */
  readonly providers: AuthProviders
  readonly signIn: (creds: Credentials) => Promise<void>
  /** Create an account; resolves `true` when signed in, `false` when the server
   *  requires email verification first (the screen then says "check your inbox"). */
  readonly signUp: (input: SignUpInput) => Promise<boolean>
  readonly signOut: () => Promise<void>
  /** Begin an OAuth sign-in by opening the provider's authorize URL. */
  readonly startSocial: (provider: SocialProvider) => void
  /** Email a password-reset link. Resolves regardless of whether the email exists. */
  readonly requestReset: (email: string) => Promise<void>
}

export function useSession(): SessionResource {
  const base = apiBaseUrl
  const live = base !== null
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)
  const [providers, setProviders] = useState<AuthProviders>(EMAIL_ONLY)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // No backend → no session; the gate shows the login screen (never a demo user).
    const load = base === null ? Promise.resolve<AuthUser | null>(null) : getSession(base)
    load
      .then(u => {
        if (alive) {
          setUser(u)
          setError(null)
        }
      })
      .catch(() => {
        // A failed session probe (server unreachable / timed out / not signed in)
        // simply means "show the login screen" — not a user-facing error, so the
        // form stays clean until an actual sign-in attempt fails.
        if (alive) {
          setUser(null)
          setError(null)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base])

  // Which sign-in methods this deployment offers (email always; social only when
  // its OAuth secrets are set). Best-effort — a failure leaves email-only.
  useEffect(() => {
    if (base === null) return
    let alive = true
    fetchProviders(base)
      .then(p => {
        if (alive) setProviders(p)
      })
      .catch(() => {
        if (alive) setProviders(EMAIL_ONLY)
      })
    return () => {
      alive = false
    }
  }, [base])

  const signIn = useCallback(
    async (creds: Credentials) => {
      if (base === null) {
        setError(new Error(OFFLINE))
        throw new Error(OFFLINE)
      }
      setBusy(true)
      setError(null)
      try {
        setUser(await apiSignIn(base, creds))
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        throw cause
      } finally {
        setBusy(false)
      }
    },
    [base],
  )

  const signUp = useCallback(
    async (input: SignUpInput): Promise<boolean> => {
      if (base === null) {
        setError(new Error(OFFLINE))
        throw new Error(OFFLINE)
      }
      setBusy(true)
      setError(null)
      try {
        const u = await apiSignUp(base, input)
        if (u !== null) setUser(u)
        return u !== null
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        throw cause
      } finally {
        setBusy(false)
      }
    },
    [base],
  )

  const startSocial = useCallback(
    (provider: SocialProvider) => {
      if (base === null) {
        setError(new Error(OFFLINE))
        return
      }
      setError(null)
      startSocialSignIn(base, provider, callbackUrl(base))
        .then(url => Linking.openURL(url))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
    },
    [base],
  )

  const signOut = useCallback(async () => {
    if (base !== null) {
      setBusy(true)
      try {
        await apiSignOut(base)
      } finally {
        setBusy(false)
      }
    }
    setUser(null)
  }, [base])

  const requestReset = useCallback(
    async (email: string) => {
      if (base === null) throw new Error(OFFLINE)
      await requestPasswordReset(base, email)
    },
    [base],
  )

  return {
    user,
    loading,
    error,
    live,
    busy,
    providers,
    signIn,
    signUp,
    signOut,
    startSocial,
    requestReset,
  }
}
