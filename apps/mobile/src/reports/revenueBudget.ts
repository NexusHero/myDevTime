import { effectiveRateMinorPerHour, revenueByClient, type ProjectCost } from '@mydevtime/domain'
import type { Client } from '../screens/projectsData.js'

/**
 * Pure assembly for the Reports "Revenue & Budget" per-client card (D13). Joins the
 * deterministic per-project figures — billable time (from the tracking summary) and
 * revenue (from the billing summary) — up to each client via the catalog, and derives
 * the billable share and effective rate. Money stays the core's: the per-project
 * amounts come priced from the server, `revenueByClient`/`effectiveRateMinorPerHour`
 * are the domain's, and this only groups and formats.
 */

export interface ProjectTime {
  readonly projectId: string
  readonly spentMs: number
  readonly billableMs: number
}

export interface ClientRevenueRow {
  readonly clientId: string
  readonly name: string
  readonly revenueMinor: number
  readonly spentMs: number
  readonly billableMs: number
  /** Billable share of tracked time, 0–100 (integer); 0 when nothing was tracked. */
  readonly billablePct: number
  /** Effective €/h in minor units, or `null` when there is no billable time. */
  readonly effectiveRateMinorPerHour: number | null
}

export function buildClientRevenueRows(
  catalog: readonly Client[],
  timeByProject: readonly ProjectTime[],
  costByProject: readonly ProjectCost[],
): ClientRevenueRow[] {
  const clientOfProject = new Map<string, string | null>()
  for (const c of catalog) {
    for (const p of c.projects) clientOfProject.set(p.id, c.id)
  }

  // Money rolled up by the deterministic core; time summed alongside (time is not money).
  const revenue = new Map<string | null, number>()
  for (const r of revenueByClient(costByProject, clientOfProject)) revenue.set(r.clientId, r.minor)
  const time = new Map<string, { spentMs: number; billableMs: number }>()
  for (const t of timeByProject) {
    const clientId = clientOfProject.get(t.projectId)
    if (clientId == null) continue // time on no-client / unknown projects is not a client row
    const acc = time.get(clientId) ?? { spentMs: 0, billableMs: 0 }
    acc.spentMs += t.spentMs
    acc.billableMs += t.billableMs
    time.set(clientId, acc)
  }

  return catalog
    .map(c => {
      const revenueMinor = revenue.get(c.id) ?? 0
      const t = time.get(c.id) ?? { spentMs: 0, billableMs: 0 }
      return {
        clientId: c.id,
        name: c.name,
        revenueMinor,
        spentMs: t.spentMs,
        billableMs: t.billableMs,
        billablePct: t.spentMs > 0 ? Math.round((t.billableMs / t.spentMs) * 100) : 0,
        effectiveRateMinorPerHour: effectiveRateMinorPerHour(revenueMinor, t.billableMs),
      }
    })
    .filter(r => r.spentMs > 0 || r.revenueMinor > 0) // only clients active in the window
    .sort((a, b) => b.revenueMinor - a.revenueMinor || a.name.localeCompare(b.name))
}
