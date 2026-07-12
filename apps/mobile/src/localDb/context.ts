import { createContext, useContext } from 'react'
import type { LocalDb } from '@mydevtime/local-db'

/**
 * The open local database (ADR-0040), or `null` while it opens / when no provider
 * is mounted. `useLocalDb` is **non-throwing on purpose**: hooks fall back to demo
 * data when it is `null` (the test gate renders screens without a `LocalDbProvider`,
 * so they keep the demo path unchanged). This file imports no vendor driver, so it
 * stays out of the render-test module graph.
 */
export const LocalDbContext = createContext<LocalDb | null>(null)

/** The open local DB, or `null` (opening / no provider). Never throws. */
export function useLocalDb(): LocalDb | null {
  return useContext(LocalDbContext)
}

/**
 * The single synthetic workspace id used in standalone mode (ADR-0040): no account,
 * one local workspace. When team sync turns on, real workspace ids replace it —
 * same schema, no migration.
 */
export const LOCAL_WORKSPACE_ID = 'local'
