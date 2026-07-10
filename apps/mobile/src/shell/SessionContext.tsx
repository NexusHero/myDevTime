import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/auth.js'
import type { SessionResource } from '../hooks/useSession.js'

/**
 * The authenticated session, shared with the whole app (REQ-002). `AuthGate` owns
 * the one `useSession` and publishes it here so any screen (e.g. Profile's
 * identity + sign-out) reads the same session instead of probing it again.
 */
const SessionContext = createContext<SessionResource | null>(null)

export const SessionProvider = SessionContext.Provider

/** Read the current session; throws if used outside `AuthGate`'s provider. */
export function useSessionContext(): SessionResource {
  const ctx = useContext(SessionContext)
  if (ctx === null) throw new Error('useSessionContext must be used within a SessionProvider')
  return ctx
}

/** Initials for the avatar: two from a two-part name, else the first two letters. */
export function initialsOf(user: Pick<AuthUser, 'name' | 'email'>): string {
  const base = (user.name.trim() || user.email.trim()).trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const first = parts[0] ?? ''
  return (first.slice(0, 2) || '?').toUpperCase()
}
