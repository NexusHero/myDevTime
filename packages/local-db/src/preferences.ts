import type { LocalDb } from './client.js'

export async function getPreferences(db: LocalDb): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM preferences',
  )
  const prefs: Record<string, string> = {}
  for (const row of rows) {
    prefs[row.key] = row.value
  }
  return prefs
}

export async function updatePreferences(
  db: LocalDb,
  updates: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(updates)
  if (entries.length === 0) return

  // Run in a transaction
  await db.execAsync('BEGIN TRANSACTION')
  try {
    for (const [key, value] of entries) {
      await db.runAsync(
        'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      )
    }
    await db.execAsync('COMMIT')
  } catch (error) {
    await db.execAsync('ROLLBACK')
    throw error
  }
}
