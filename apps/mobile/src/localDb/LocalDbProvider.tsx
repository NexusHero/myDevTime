import { useEffect, useState } from 'react'
import { View } from 'react-native'
import type { LocalDb } from '@mydevtime/local-db'
import { LocalDbContext } from './context'
import { openExpoLocalDb } from './expoAdapter'
import { seedIfEmpty } from './seed'

/**
 * Opens the local SQLite database once at app start and provides it (ADR-0040).
 * On failure it degrades to `null` (children render on the demo path rather than
 * crashing — AI/offline features are additive, never a hard dependency). This is
 * the only place the `expo-sqlite` adapter is imported, so the render-test suite
 * (which does not mount this provider) never loads the native driver.
 */
export function LocalDbProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [db, setDb] = useState<LocalDb | null>(null)

  useEffect(() => {
    let alive = true
    openExpoLocalDb()
      .then(async opened => {
        await seedIfEmpty(opened) // populate a starter catalog on first launch
        return opened
      })
      .then(opened => {
        if (alive) setDb(opened)
      })
      .catch(() => {
        // Leave `db` null: children fall back to demo data (useLocalDb → null).
      })
    return () => {
      alive = false
    }
  }, [])

  // Render children immediately; the value is null until the DB is open, and the
  // consuming hooks treat null as "not ready → demo", so nothing blocks on I/O.
  return (
    <LocalDbContext.Provider value={db}>
      <View style={{ flex: 1 }}>{children}</View>
    </LocalDbContext.Provider>
  )
}
