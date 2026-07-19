import type { Provider } from '@nestjs/common'
import {
  baselineRange,
  rangeMidpoint,
  type TaskCategory,
  type TaskComplexity,
} from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * AI task-estimate review (REQ-041, #90 · ADR-0005). The deterministic core owns the number: a
 * category + complexity yield a **baseline range** (in `packages/domain`, exhaustively tested), and
 * that range is both the grounding for the AI and the degradation fallback. The LLM may *adjust*
 * the estimate given the note and comparable past samples, but it only proposes — its number is
 * **clamped into a sane multiple of the baseline** so it can nudge but never return an absurd value
 * (the deterministic baseline bounds it, ADR-0005). When AI is withheld, the provider is down, or the
 * completion is unparseable, the always-available baseline midpoint is returned and nothing is charged.
 * Proposal-only: nothing is written to a task — the client confirms via the existing `setTaskEstimate`.
 */

/** One comparable past task the client already tracked — grounds the AI's adjustment. */
export interface EstimateSampleInput {
  readonly category: TaskCategory
  readonly complexity: TaskComplexity
  readonly actualMinutes: number
}

/** The estimate request, as it arrives from the validated DTO (optional fields may be `undefined`). */
export interface EstimateInput {
  readonly category?: TaskCategory | undefined
  readonly complexity?: TaskComplexity | undefined
  readonly note?: string | undefined
  readonly samples?: readonly EstimateSampleInput[] | undefined
}

export interface EstimateResult {
  readonly source: 'deterministic' | 'ai-proposal'
  /** The single integer-minute estimate (baseline midpoint, or the clamped AI proposal). */
  readonly estimateMinutes: number
  readonly rationale: string
  /** The deterministic baseline range, in minutes — the client renders it and it bounds the AI. */
  readonly baselineMin: number
  readonly baselineMax: number
}

/** Defaults when the client omits a dimension — a mid feature is the honest neutral baseline. */
const DEFAULT_CATEGORY: TaskCategory = 'feature'
const DEFAULT_COMPLEXITY: TaskComplexity = 'medium'
const MAX_OUTPUT_TOKENS = 200
const MAX_RATIONALE = 300

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    estimateMinutes: { type: 'number' },
    rationale: { type: 'string' },
  },
  required: ['estimateMinutes', 'rationale'],
} as const

interface Baseline {
  readonly category: TaskCategory
  readonly complexity: TaskComplexity
  readonly baselineMin: number
  readonly baselineMax: number
  readonly midpoint: number
}

/** The deterministic baseline in whole minutes (the domain range is hours). */
function computeBaseline(input: EstimateInput): Baseline {
  const category = input.category ?? DEFAULT_CATEGORY
  const complexity = input.complexity ?? DEFAULT_COMPLEXITY
  const range = baselineRange(category, complexity)
  return {
    category,
    complexity,
    baselineMin: Math.round(range.minHours * 60),
    baselineMax: Math.round(range.maxHours * 60),
    midpoint: Math.round(rangeMidpoint(range) * 60),
  }
}

function buildPrompt(input: EstimateInput, base: Baseline): string {
  const lines: string[] = [
    'You are a software task-estimation assistant. Propose a single realistic effort estimate,',
    'in whole MINUTES, plus a one-line rationale.',
    `The deterministic baseline for a ${base.category}/${base.complexity} task is`,
    `${String(base.baselineMin)}–${String(base.baselineMax)} minutes (midpoint ${String(base.midpoint)}).`,
    'Adjust within a sensible multiple of that baseline given the note and comparable past samples;',
    'do not return an absurd number. Reply with ONLY strict JSON of the shape',
    '{"estimateMinutes": <integer>, "rationale": <one short sentence>}. No prose, no markdown.',
  ]
  const note = input.note?.trim()
  if (note !== undefined && note.length > 0) {
    lines.push('', `TASK NOTE: ${note}`)
  }
  const samples = input.samples ?? []
  if (samples.length > 0) {
    lines.push('', 'COMPARABLE PAST TASKS (category/complexity → actual minutes):')
    for (const s of samples) {
      lines.push(`- ${s.category}/${s.complexity} → ${String(s.actualMinutes)}m`)
    }
  }
  return lines.join('\n')
}

/**
 * Strip a Markdown code fence around a JSON payload — some providers wrap valid JSON in
 * ```` ```json … ``` ```` and a raw `JSON.parse` on that would silently degrade the paid feature
 * (same belt-and-suspenders as the categorizer).
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

/** Parse the completion defensively: malformed JSON, a missing/non-finite number → `null` (degrade). */
function parseEstimate(text: string): { minutes: number; rationale: string } | null {
  let raw: unknown
  try {
    raw = JSON.parse(stripCodeFence(text))
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const rec = raw as Record<string, unknown>
  const minutes = rec.estimateMinutes
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null
  const rationale =
    typeof rec.rationale === 'string'
      ? rec.rationale.replace(/\s+/g, ' ').trim().slice(0, MAX_RATIONALE)
      : ''
  return { minutes, rationale }
}

export interface Estimator {
  compose(input: EstimateInput, opts: { allowAi: boolean }): Promise<EstimateResult>
}

export const ESTIMATOR = Symbol('ESTIMATOR')

/** The LLM-backed estimator. Never throws on the AI path — it degrades to the baseline midpoint. */
export class LlmEstimator implements Estimator {
  constructor(private readonly llm: LlmPort) {}

  private deterministic(base: Baseline): EstimateResult {
    return {
      source: 'deterministic',
      estimateMinutes: base.midpoint,
      rationale: 'from category/complexity baseline',
      baselineMin: base.baselineMin,
      baselineMax: base.baselineMax,
    }
  }

  async compose(input: EstimateInput, opts: { allowAi: boolean }): Promise<EstimateResult> {
    const base = computeBaseline(input)
    if (!opts.allowAi) return this.deterministic(base)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.deterministic(base)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(input, base) }],
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      })
      const parsed = parseEstimate(result.text)
      // Unparseable / no number → the honest baseline, and (one layer up) no charge (ADR-0008).
      if (parsed === null) return this.deterministic(base)
      // The AI proposes; the deterministic baseline BOUNDS it (ADR-0005). Clamp into a sane
      // multiple so the number can be adjusted but never absurd.
      const lo = Math.max(1, Math.round(base.baselineMin * 0.5))
      const hi = Math.round(base.baselineMax * 2)
      const estimateMinutes = Math.min(hi, Math.max(lo, Math.round(parsed.minutes)))
      const rationale =
        parsed.rationale.length > 0
          ? parsed.rationale
          : 'AI estimate adjusted from the category/complexity baseline'
      return {
        source: 'ai-proposal',
        estimateMinutes,
        rationale,
        baselineMin: base.baselineMin,
        baselineMax: base.baselineMax,
      }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.deterministic(base)
      return this.deterministic(base) // the proposal layer never fails the request (ADR-0005)
    }
  }
}

/** Binds the `ESTIMATOR` port to the LLM-backed estimator. */
export const estimatorProvider: Provider = {
  provide: ESTIMATOR,
  inject: [LLM],
  useFactory: (llm: LlmPort): Estimator => new LlmEstimator(llm),
}
