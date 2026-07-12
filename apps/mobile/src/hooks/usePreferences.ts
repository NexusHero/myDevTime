import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  DEFAULT_PREFERENCES,
  getPreferences as apiGetPreferences,
  updatePreferences as apiUpdatePreferences,
  type PreferenceKey,
  type Preferences,
} from '../api/preferences.js'
import { useLocalDb } from '../localDb/LocalDbProvider.js'
import {
  getPreferences as localGetPreferences,
  updatePreferences as localUpdatePreferences,
} from '@mydevtime/local-db'

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
  const db = useLocalDb()
  const live = base !== null
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const promise =
      base === null
        ? localGetPreferences(db).then(prefs => ({
            ...DEFAULT_PREFERENCES,
            ...(prefs as Partial<Preferences>),
          }))
        : apiGetPreferences(base)

    promise
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

        const promise =
          base === null
            ? localUpdatePreferences(db, { [key]: String(value) }).then(() => optimistic)
            : apiUpdatePreferences(base, { [key]: value })

        promise
          .then(saved => {
            setPrefs(saved)
            setError(null)
          })
          .catch((cause: unknown) => {
            setPrefs(previous) // roll back the toggle
            setError(cause instanceof Error ? cause : new Error(String(cause)))
          })
        return optimistic
      })
    },
    [base],
  )

  return { prefs, live, loading, error, setPref }
}
