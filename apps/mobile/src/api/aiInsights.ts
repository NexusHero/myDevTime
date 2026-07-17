import { postJson } from './http.js'
import { z } from 'zod'

/**
 * Grounded AI insights client (REQ-054, design v13 KI1–KI4). The client derives the facts
 * deterministically from its own workspace data and posts them; the server's LLM only
 * *phrases* them, refuses cleanly off-data, degrades when the provider is down, and debits
 * one credit only for a real proposal (ADR-0005/0029). `source` drives the violet
 * provenance signature — deterministic fallbacks never wear it.
 */
export const insightKindSchema = z.enum(['coach', 'quote', 'invoice', 'meeting'])
export type InsightKind = z.infer<typeof insightKindSchema>

export const insightProposalSchema = z.object({
  kind: insightKindSchema,
  source: z.enum(['deterministic', 'ai-proposal']),
  refused: z.boolean().default(false),
  text: z.string(),
  charged: z.boolean().default(false),
})
export type InsightProposal = z.infer<typeof insightProposalSchema>

export function parseInsightProposal(value: unknown): InsightProposal {
  return insightProposalSchema.parse(value)
}

/** Ask for a grounded insight (coach / quote / invoice / meeting) over the caller's facts. */
export async function fetchInsight(
  baseUrl: string,
  kind: InsightKind,
  facts: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<InsightProposal> {
  return parseInsightProposal(
    await postJson(baseUrl, '/api/ai/insight', { kind, facts }, fetchImpl),
  )
}
