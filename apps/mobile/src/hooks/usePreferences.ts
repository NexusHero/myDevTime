import { useCallback, useEffect, useState } from 'react'
import { getAllPreferences, setPreference } from '@mydevtime/local-db'
import { apiBaseUrl } from '../config.js'
import { LOCAL_WORKSPACE_ID, useLocalDb } from '../localDb/context.js'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences,
  type PreferenceKey,
  type Preferences,
} from '../api/preferences.js'

/**
 * The Settings toggles source (M10). Three modes behind one API:
 * - **API** (`apiBaseUrl` set): load/persist against the server.
 * - **Offline** (`apiBaseUrl` null, local DB open): load/persist in the local
 *   SQLite store (ADR-0040), so toggles survive a reload with no backend.
 * - **Demo** (no DB yet, e.g. the test gate): keep them in memory.
 * A toggle updates optimistically and rolls back if the write fails; `live` lets
 * the UI note when changes are being saved remotely.
 */
export interface PreferencesResource {
  readonly prefs: Preferences
  readonly live: boolean
  readonly loading: boolean
  readonly error: Error | null
  readonly setPref: (key: PreferenceKey, value: boolean) => void
}

/** Overlay stored `'1'`/`'0'` string values onto the defaults. */
function mergeStored(stored: Record<string, string>): Preferences {
  const out = { ...DEFAULT_PREFERENCES } as Record<PreferenceKey, boolean>
  for (const key of Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]) {
    const value = stored[key]
    if (value !== undefined) out[key] = value === '1'
  }
  return out
}

export function usePreferences(): PreferencesResource {
  const base = apiBaseUrl
  const live = base !== null
  const db = useLocalDb()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    if (base !== null) {
      setLoading(true)
      getPreferences(base)
        .then(p => {
          if (alive) {
            setPrefs(p)
            setError(null)
          }
        })
        .catch((cause: unknown) => {
          if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
      return () => {
        alive = false
      }
    }
    // Offline: hydrate from the local store once it is open (demo until then).
    if (db === null) return
    setLoading(true)
    getAllPreferences(db, LOCAL_WORKSPACE_ID)
      .then(stored => {
        if (alive) {
          setPrefs(mergeStored(stored))
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base, db])

  const setPref = useCallback(
    (key: PreferenceKey, value: boolean) => {
      setPrefs(previous => {
        const optimistic = { ...previous, [key]: value }
        if (base !== null) {
          updatePreferences(base, { [key]: value })
            .then(saved => {
              setPrefs(saved)
              setError(null)
            })
            .catch((cause: unknown) => {
              setPrefs(previous) // roll back the toggle
              setError(cause instanceof Error ? cause : new Error(String(cause)))
            })
        } else if (db !== null) {
          setPreference(db, LOCAL_WORKSPACE_ID, key, value ? '1' : '0').catch((cause: unknown) => {
            setPrefs(previous) // roll back the toggle
            setError(cause instanceof Error ? cause : new Error(String(cause)))
          })
        }
        return optimistic
      })
    },
    [base, db],
  )

  return { prefs, live, loading, error, setPref }
}
