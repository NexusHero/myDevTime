import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  updatePreferences,
  type PreferenceKey,
  type Preferences,
} from '../api/preferences.js'

/**
 * The Settings toggles source (M10): when an API base URL is configured the hook
 * loads the caller's stored preferences and persists each change; otherwise — the
 * local-dev/test default — it keeps them in memory so the screen still works. A
 * toggle updates optimistically and rolls back if the PUT fails, and `live` lets
 * the UI note when changes are actually being saved.
 */
export interface PreferencesResource {
  readonly prefs: Preferences
  readonly live: boolean
  readonly loading: boolean
  readonly error: Error | null
  readonly setPref: (key: PreferenceKey, value: boolean) => void
}

export function usePreferences(): PreferencesResource {
  const base = apiBaseUrl
  const live = base !== null
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (base === null) return
    let alive = true
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
  }, [base])

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
        }
        return optimistic
      })
    },
    [base],
  )

  return { prefs, live, loading, error, setPref }
}
