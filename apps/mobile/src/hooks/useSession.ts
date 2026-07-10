import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  getSession,
  signIn as apiSignIn,
  signOut as apiSignOut,
  type AuthUser,
  type Credentials,
} from '../api/auth.js'

/**
 * The session for the auth gate (REQ-002). When an API base URL is configured it
 * loads `/api/auth/me` and drives sign-in/out through the auth seam; otherwise —
 * the default in local dev and the test gate — it resolves a demo user so the app
 * runs without a backend (the login screen never blocks demo mode). `live` lets
 * the UI tell the two apart.
 */
const DEMO_USER: AuthUser = {
  id: 'demo',
  email: 'demo@mydevtime.app',
  emailVerified: true,
  name: 'Demo User',
}

export interface SessionResource {
  readonly user: AuthUser | null
  readonly loading: boolean
  readonly error: Error | null
  readonly live: boolean
  readonly busy: boolean
  readonly signIn: (creds: Credentials) => Promise<void>
  readonly signOut: () => Promise<void>
}

export function useSession(): SessionResource {
  const base = apiBaseUrl
  const live = base !== null
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const load = base === null ? Promise.resolve<AuthUser | null>(DEMO_USER) : getSession(base)
    load
      .then(u => {
        if (alive) {
          setUser(u)
          setError(null)
        }
      })
      .catch(() => {
        // A failed session probe (server unreachable / timed out / not signed in)
        // simply means "show the login screen" — it is not a user-facing error, so
        // the form stays clean until an actual sign-in attempt fails.
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

  const signIn = useCallback(
    async (creds: Credentials) => {
      if (base === null) {
        setUser(DEMO_USER)
        return
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

  return { user, loading, error, live, busy, signIn, signOut }
}
