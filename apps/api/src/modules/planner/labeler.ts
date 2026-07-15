import type { Provider } from '@nestjs/common'
import { deterministicLabels, type DayPlan, type PlanLabel } from '@mydevtime/domain'
import { LLM, LlmUnavailableError, type LlmPort } from '../ai/contract.js'

/**
 * The Co-Planner label port (REQ-031 follow-up, #151, ADR-0011/0031). The planner
 * depends on THIS interface, never on the LLM or billing directly (DIP). The LLM
 * *garnish* only ranks/labels the code-enforced blocks — it never places time
 * (ADR-0005) — and everything degrades to the deterministic labels when the
 * provider is unavailable or the caller opts out. Credit pricing happens one layer
 * up, in the controller, so this port stays free of billing concerns.
 */
export interface LabelResult {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly labels: readonly PlanLabel[]
}

export interface PlanLabeler {
  /**
   * Label a plan. `allowAi` lets the caller withhold the LLM (e.g. no credits);
   * even when `true`, a down or malformed provider still yields deterministic
   * labels — the call never fails on the AI path.
   */
  label(plan: DayPlan, opts: { allowAi: boolean }): Promise<LabelResult>
}

export const PLAN_LABELER = Symbol('PLAN_LABELER')

/** The always-available fallback: the pure deterministic labels. */
export class DeterministicPlanLabeler implements PlanLabeler {
  label(plan: DayPlan, _opts?: { allowAi: boolean }): Promise<LabelResult> {
    return Promise.resolve({ source: 'deterministic', labels: deterministicLabels(plan) })
  }
}

const LABEL_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      blockIndex: { type: 'integer' },
      note: { type: 'string' },
      rank: { type: 'integer' },
    },
    required: ['blockIndex', 'note', 'rank'],
  },
} as const

function buildPrompt(plan: DayPlan): string {
  const lines = plan.blocks.map(
    (b, i) =>
      `${String(i)}: ${b.kind} "${b.label}" (${String(b.startMin)}–${String(b.startMin + b.lenMin)} min)`,
  )
  return [
    'You are the Co-Planner. Rank and label the following, already-fixed day',
    'blocks — you move NOTHING and invent no blocks. For each block give a short,',
    'calm English label (note) and a rank: 1..n in the order in which the focus',
    'blocks should be tackled; meetings and breaks get rank 0. Answer as a JSON',
    'array matching the schema.',
    '',
    ...lines,
  ].join('\n')
}

/**
 * Strip a Markdown code fence around a JSON payload. Gemini and other providers
 * wrap valid JSON in ```` ```json … ``` ````; a raw `JSON.parse` on that rejects it
 * and the paid AI garnish degrades to deterministic. Providers driven through the
 * schema path already emit bare JSON — this is the belt-and-suspenders for the rest.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

/** Validate an LLM completion into `PlanLabel[]` for THIS plan, or null if unusable. */
function parseLabels(text: string, plan: DayPlan): PlanLabel[] | null {
  let raw: unknown
  try {
    raw = JSON.parse(stripCodeFence(text))
  } catch {
    return null
  }
  if (!Array.isArray(raw) || raw.length !== plan.blocks.length) return null
  const labels: PlanLabel[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const rec = item as Record<string, unknown>
    const blockIndex = rec.blockIndex
    const note = rec.note
    const rank = rec.rank
    if (
      typeof blockIndex !== 'number' ||
      !Number.isInteger(blockIndex) ||
      blockIndex < 0 ||
      blockIndex >= plan.blocks.length ||
      typeof note !== 'string' ||
      note.length === 0 ||
      typeof rank !== 'number' ||
      !Number.isInteger(rank) ||
      rank < 0
    ) {
      return null
    }
    labels.push({ blockIndex, note, rank })
  }
  return labels
}

/**
 * The LLM-backed labeler over the provider-agnostic `LlmPort`. Never throws on the
 * AI path: an unavailable provider, a thrown call, or an unparseable completion all
 * fall back to the deterministic labels.
 */
export class LlmPlanLabeler implements PlanLabeler {
  constructor(private readonly llm: LlmPort) {}

  private fallback(plan: DayPlan): LabelResult {
    return { source: 'deterministic', labels: deterministicLabels(plan) }
  }

  async label(plan: DayPlan, opts: { allowAi: boolean }): Promise<LabelResult> {
    if (!opts.allowAi || plan.blocks.length === 0) return this.fallback(plan)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.fallback(plan)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(plan) }],
        responseSchema: LABEL_SCHEMA,
        temperature: 0,
      })
      const parsed = parseLabels(result.text, plan)
      return parsed === null ? this.fallback(plan) : { source: 'ai-proposal', labels: parsed }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.fallback(plan)
      return this.fallback(plan) // the garnish never fails the request
    }
  }
}

/** Binds the `PLAN_LABELER` port to the LLM-backed labeler over the configured `LlmPort`. */
export const planLabelerProvider: Provider = {
  provide: PLAN_LABELER,
  inject: [LLM],
  useFactory: (llm: LlmPort): PlanLabeler => new LlmPlanLabeler(llm),
}
