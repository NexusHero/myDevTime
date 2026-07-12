import type { LocalDb } from './client.js'

export async function getConnectors(_db: LocalDb): Promise<any[]> {
  // Offline connectors are static since we can't sync offline
  return []
}
