import { postJson } from './http.js'
import { record, str } from './parse.js'

/**
 * Grounded AI insights client (REQ-054, design v13 KI1–KI4). The client derives the facts
 * deterministically from its own workspace data and posts them; the server's LLM only
 * *phrases* them, refuses cleanly off-data, degrades when the provider is down, and debits
 * one credit only for a real proposal (ADR-0005/0029). `source` drives the violet
 * provenance signature — deterministic fallbacks never wear it.
 */
export type InsightKind = 'coach' | 'quote' | 'invoice' | 'meeting'

export interface InsightProposal {
  readonly kind: InsightKind
  readonly source: 'deterministic' | 'ai-proposal'
  readonly refused: boolean
  readonly text: string
  readonly charged: boolean
}

export function parseInsightProposal(value: unknown): InsightProposal {
  const o = record(value)
  return {
    kind: str(o, 'kind') as InsightKind,
    source: str(o, 'source') as 'deterministic' | 'ai-proposal',
    refused: o.refused === true,
    text: str(o, 'text'),
    charged: o.charged === true,
  }
}

/** Ask for a grounded insight (coach / quote / invoice / meeting) over the caller's facts. */
export async function fetchInsight(
  baseUrl: string,
  kind: InsightKind,
  facts: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<InsightProposal> {
  return parseInsightProposal(await postJson(baseUrl, '/api/ai/insight', { kind, facts }, fetchImpl))
}
