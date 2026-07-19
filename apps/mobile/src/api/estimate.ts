import { postJson } from './http.js'
import { z } from 'zod'

/**
 * The AI task-estimate client (REQ-041, ADR-0005/0029). The client sends the task's
 * category/complexity (plus an optional note and its own past actuals as samples); the server
 * returns a **proposal only** — a suggested estimate in minutes, the deterministic baseline range
 * it sits in, and a rationale. Nothing is written to the task until the user taps Apply, which
 * goes through the ordinary `setTaskEstimate` tracking PATCH. `source` carries the provenance the
 * UI must show: `ai-proposal` means the LLM proposed and a credit was spent (`charged: true`);
 * `deterministic` is the honest, free degradation (provider down / no credits / unparseable) where
 * the number is the baseline midpoint. Every field the API omits or garbles is defaulted here so
 * the UI never sees `undefined`.
 */
export const estimateSourceSchema = z.enum(['deterministic', 'ai-proposal']).catch('deterministic')
export type EstimateSource = z.infer<typeof estimateSourceSchema>

export const estimateCategorySchema = z.enum(['feature', 'bug', 'chore', 'research', 'meeting'])
export type EstimateCategory = z.infer<typeof estimateCategorySchema>

export const estimateComplexitySchema = z.enum(['trivial', 'small', 'medium', 'large', 'xlarge'])
export type EstimateComplexity = z.infer<typeof estimateComplexitySchema>

export const estimateProposalSchema = z.object({
  source: estimateSourceSchema,
  charged: z.boolean().catch(false),
  estimateMinutes: z.number().catch(0),
  rationale: z.string().catch(''),
  baselineMin: z.number().catch(0),
  baselineMax: z.number().catch(0),
})
export type EstimateProposal = z.infer<typeof estimateProposalSchema>

/** One past actual the estimator may weigh (the caller's own history — never invented). */
export interface EstimateSample {
  readonly category: EstimateCategory
  readonly complexity: EstimateComplexity
  readonly actualMinutes: number
}

/** The estimate request: the caller's task shape; every field is optional (server has defaults). */
export interface EstimateInput {
  readonly category?: EstimateCategory
  readonly complexity?: EstimateComplexity
  readonly note?: string
  readonly samples?: readonly EstimateSample[]
}

export function parseEstimateProposal(value: unknown): EstimateProposal {
  return estimateProposalSchema.parse(value)
}

/**
 * Ask for an effort estimate (read-only — the server applies nothing, ADR-0005). Returns a
 * proposal the user reviews and then applies via the ordinary `setTaskEstimate` mutation.
 */
export async function requestEstimate(
  baseUrl: string,
  input: EstimateInput,
  fetchImpl: typeof fetch = fetch,
): Promise<EstimateProposal> {
  return parseEstimateProposal(await postJson(baseUrl, '/api/ai/estimate', input, fetchImpl))
}
