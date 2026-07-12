import type { LocalDb } from './client.js'

export interface LocalSummary {
  readonly totalMs: number
  readonly billableMs: number
}

export interface LocalProjectSummary {
  readonly projectId: string
  spentMs: number
  daily: number[]
}

export async function getSummary(db: LocalDb, from: string, to: string): Promise<LocalSummary> {
  const row = await db.getFirstAsync<{ total: number, billable: number }>(
    `SELECT 
      SUM(
        CASE WHEN ended_at IS NOT NULL 
        THEN (julianday(ended_at) - julianday(started_at)) * 86400000 
        ELSE 0 END
      ) as total,
      SUM(
        CASE WHEN ended_at IS NOT NULL AND billable = 1 
        THEN (julianday(ended_at) - julianday(started_at)) * 86400000 
        ELSE 0 END
      ) as billable
    FROM time_entries 
    WHERE started_at >= ? AND started_at < ?`,
    [from, to]
  )
  return {
    totalMs: Math.round(row?.total ?? 0),
    billableMs: Math.round(row?.billable ?? 0),
  }
}

export async function getProjectSummary(db: LocalDb, from: string, to: string): Promise<LocalProjectSummary[]> {
  const rows = await db.getAllAsync<{ project_id: string, spent: number, day: string }>(
    `SELECT 
      project_id,
      date(started_at) as day,
      SUM(
        CASE WHEN ended_at IS NOT NULL 
        THEN (julianday(ended_at) - julianday(started_at)) * 86400000 
        ELSE 0 END
      ) as spent
    FROM time_entries 
    WHERE started_at >= ? AND started_at < ?
    GROUP BY project_id, day`,
    [from, to]
  )
  
  const byProject = new Map<string, LocalProjectSummary>()
  
  for (const r of rows) {
    const pId = r.project_id || '(none)'
    const existing = byProject.get(pId) || { projectId: pId, spentMs: 0, daily: Array(7).fill(0) }
    
    existing.spentMs += Math.round(r.spent)
    
    // Simple daily mapping: (day - from) in days
    const msDiff = new Date(r.day).getTime() - new Date(from.substring(0, 10)).getTime()
    const dayIdx = Math.floor(msDiff / 86400000)
    if (dayIdx >= 0 && dayIdx < 7) {
      existing.daily[dayIdx] += Math.round(r.spent)
    }
    
    byProject.set(pId, existing)
  }
  
  return Array.from(byProject.values())
}

export async function getWorktimeBalance(db: LocalDb, from: string, to: string): Promise<number> {
  const row = await db.getFirstAsync<{ worked: number }>(
    `SELECT 
      SUM(
        CASE WHEN ended_at IS NOT NULL 
        THEN (julianday(ended_at) - julianday(started_at)) * 86400000 - break_ms
        ELSE 0 END
      ) as worked
    FROM shifts 
    WHERE started_at >= ? AND started_at < ?`,
    [from, to]
  )
  
  const worked = Math.round(row?.worked ?? 0)
  // Assume 40h target per week
  const target = 40 * 3600000
  return worked - target
}
