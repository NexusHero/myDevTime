import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

/**
 * Dev-tool export runner (REQ-035): push confirmed insight/action items to Jira/Linear/Slack through
 * the narrow `ExportTargetPort`, **idempotently** and with **recorded results**. The rules are
 * ADR-0035/0005: only **confirmed** items are sent; an item whose `dedupeKey` is already in the seen
 * set is **skipped** (a re-run never double-posts); an unavailable target degrades to "nothing sent"
 * rather than a partial post. Each attempt records its outcome so the caller can persist the ledger.
 */

export type ExportOutcome = 'sent' | 'unconfirmed' | 'duplicate' | 'unavailable' | 'failed'

export interface ExportRecord {
  readonly dedupeKey: string
  readonly outcome: ExportOutcome
  readonly result?: ExportResult
}

export interface ExportRun {
  readonly records: readonly ExportRecord[]
  readonly sentCount: number
}

/**
 * Run an export over `items`, skipping the unconfirmed and the already-exported (`seen`). If the
 * target is unavailable, every eligible item is recorded `unavailable` and nothing is sent. Sends
 * are sequential so `seen` (and the target) see a stable order; each result is recorded. Pure
 * orchestration over the port — the port does the vendor call, this decides *whether* to call.
 */
export async function runExport(
  port: ExportTargetPort,
  items: readonly ExportItem[],
  seen: ReadonlySet<string>,
): Promise<ExportRun> {
  const available = await port.available()
  const records: ExportRecord[] = []
  const sentThisRun = new Set<string>()
  let sentCount = 0

  for (const item of items) {
    if (!item.confirmed) {
      records.push({ dedupeKey: item.dedupeKey, outcome: 'unconfirmed' })
      continue
    }
    if (seen.has(item.dedupeKey) || sentThisRun.has(item.dedupeKey)) {
      records.push({ dedupeKey: item.dedupeKey, outcome: 'duplicate' })
      continue
    }
    if (!available) {
      records.push({ dedupeKey: item.dedupeKey, outcome: 'unavailable' })
      continue
    }
    try {
      const result = await port.send(item)
      if (result.ok) {
        sentThisRun.add(item.dedupeKey)
        sentCount++
        records.push({ dedupeKey: item.dedupeKey, outcome: 'sent', result })
      } else {
        records.push({ dedupeKey: item.dedupeKey, outcome: 'failed', result })
      }
    } catch (err) {
      if (err instanceof ExportUnavailableError) {
        records.push({ dedupeKey: item.dedupeKey, outcome: 'unavailable' })
      } else {
        records.push({
          dedupeKey: item.dedupeKey,
          outcome: 'failed',
          result: { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
        })
      }
    }
  }
  return { records, sentCount }
}
