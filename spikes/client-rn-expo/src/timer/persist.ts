import * as SQLite from 'expo-sqlite'
import type { TimerState } from './elapsed.js'
import { STOPPED } from './elapsed.js'

/**
 * Timer persistence port + expo-sqlite adapter (Q1). The timer's whole state is
 * two numbers (see elapsed.ts); persisting them synchronously on every
 * start/pause is what makes a running timer survive app kill and reboot — on cold
 * start we read them back and re-derive elapsed against the wall clock.
 *
 * The port keeps the storage vendor at the edge (process skill §2.2): the timer
 * UI depends on `TimerStore`, not on expo-sqlite.
 */
export interface TimerStore {
  load(): Promise<TimerState>
  save(state: TimerState): Promise<void>
}

const DDL = `CREATE TABLE IF NOT EXISTS timer_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at INTEGER,
  accumulated_ms INTEGER NOT NULL
);`

export async function createTimerStore(): Promise<TimerStore> {
  const db = await SQLite.openDatabaseAsync('mydevtime-spike.db')
  await db.execAsync(DDL)
  return {
    async load() {
      const row = await db.getFirstAsync<{ started_at: number | null; accumulated_ms: number }>(
        'SELECT started_at, accumulated_ms FROM timer_state WHERE id = 1',
      )
      if (!row) return STOPPED
      return { startedAt: row.started_at, accumulatedMs: row.accumulated_ms }
    },
    async save(state) {
      await db.runAsync(
        'INSERT OR REPLACE INTO timer_state (id, started_at, accumulated_ms) VALUES (1, ?, ?)',
        state.startedAt,
        state.accumulatedMs,
      )
    },
  }
}
