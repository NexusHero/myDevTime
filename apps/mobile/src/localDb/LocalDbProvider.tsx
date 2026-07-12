import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SQLite from 'expo-sqlite'
import { openLocalDb, type LocalDb } from '@mydevtime/local-db'
import { Text, View } from 'react-native'

const LocalDbContext = createContext<LocalDb | null>(null)

export function LocalDbProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [db, setDb] = useState<LocalDb | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    openLocalDb(SQLite)
      .then(d => {
        if (alive) setDb(d)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)))
      })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>Failed to open local database: {error.message}</Text>
      </View>
    )
  }

  if (!db) {
    // Render a blank screen while the DB is opening (usually instantaneous)
    return <View style={{ flex: 1 }} />
  }

  return <LocalDbContext.Provider value={db}>{children}</LocalDbContext.Provider>
}

export function useLocalDb(): LocalDb {
  const ctx = useContext(LocalDbContext)
  if (!ctx) {
    throw new Error('useLocalDb must be used within a LocalDbProvider')
  }
  return ctx
}
