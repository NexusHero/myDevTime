import type { Provider } from '@nestjs/common'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * LLM categorization proposals (REQ-012, #17 · ADR-0005/0029). A batch of uncategorized
 * entries (key + note + source) is put to the model, which proposes a project, tags,
 * billability and a confidence per item — **proposals only**: nothing is applied until the
 * user confirms client-side, and every proposal is marked `ai-proposal` so provenance
 * survives (ADR-0005). The hard grounding rule: a proposed project MUST be one of the
 * caller's `knownProjects` (matched case-insensitively, returned in the canonical
 * spelling) — the AI can never invent a project; anything else is nulled. A down
 * provider, empty batch, withheld AI or an unparseable completion all degrade to
 * `source: 'none'` with no proposals — and, one layer up, no charge (ADR-0008).
 */

export type CategorizeConfidence = 'low' | 'medium' | 'high'

/** One entry to categorize, as it arrives from the validated DTO (optional fields may be `undefined`). */
export interface CategorizeItemInput {
  readonly key: string
  readonly note?: string | undefined
  readonly source?: string | undefined
}

export interface CategoryProposal {
  readonly key: string
  /** The canonical `knownProjects` spelling, or `null` — the AI never invents a project. */
  readonly project: string | null
  readonly tags: readonly string[]
  /** `null` when the model gave no usable verdict — never coerced to a guess. */
  readonly billable: boolean | null
  readonly confidence: CategorizeConfidence
}

export interface CategorizeResult {
  readonly source: 'ai-proposal' | 'none'
  readonly proposals: readonly CategoryProposal[]
}

const NONE: CategorizeResult = { source: 'none', proposals: [] }
const MAX_TAGS = 5
const MAX_OUTPUT_TOKENS = 1_000

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      project: { type: ['string', 'null'] },
      tags: { type: 'array', items: { type: 'string' } },
      billable: { type: 'boolean' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['key', 'project', 'tags', 'billable', 'confidence'],
  },
} as const

function buildPrompt(
  items: readonly CategorizeItemInput[],
  knownProjects: readonly string[],
): string {
  const lines = items.map(i => {
    const parts = [`key=${i.key}`]
    if (i.note !== undefined && i.note.length > 0) parts.push(`note="${i.note}"`)
    if (i.source !== undefined && i.source.length > 0) parts.push(`source=${i.source}`)
    return `- ${parts.join(' ')}`
  })
  return [
    'You are a time-entry categorization engine. For each ITEM below, propose a category.',
    'Reply with ONLY a strict JSON array — one object per item, no prose, no markdown — of',
    'the shape {"key": string, "project": string|null, "tags": string[], "billable": boolean,',
    '"confidence": "low"|"medium"|"high"}.',
    '- "project" MUST be one of the KNOWN PROJECTS, spelled exactly as listed, or null when',
    '  none fits. NEVER invent a project name.',
    `- "tags": up to ${String(MAX_TAGS)} short lowercase tags grounded in the note; invent nothing.`,
    '- "confidence" reflects how sure you are; use "low" when guessing.',
    '',
    'KNOWN PROJECTS:',
    knownProjects.length > 0 ? knownProjects.map(p => `- ${p}`).join('\n') : '(none)',
    '',
    'ITEMS:',
    ...lines,
  ].join('\n')
}

/**
 * Strip a Markdown code fence around a JSON payload (same belt-and-suspenders as the
 * Co-Planner labeler): some providers wrap valid JSON in ```` ```json … ``` ```` and a raw
 * `JSON.parse` on that would silently degrade the paid feature.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

/** Resolve a proposed project against `knownProjects` case-insensitively — canonical spelling or null. */
function canonicalProject(value: unknown, knownProjects: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  const wanted = value.trim().toLowerCase()
  if (wanted.length === 0) return null
  return knownProjects.find(p => p.toLowerCase() === wanted) ?? null
}

function parseTags(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .slice(0, MAX_TAGS)
}

function parseConfidence(value: unknown): CategorizeConfidence {
  return value === 'medium' || value === 'high' ? value : 'low'
}

/**
 * Parse the completion defensively into proposals: fences stripped, malformed JSON is
 * "nothing", malformed rows are skipped, a row for an unknown or repeated `key` is
 * ignored (the model cannot invent items), and the project is canonicalized-or-nulled.
 */
function parseProposals(
  text: string,
  items: readonly CategorizeItemInput[],
  knownProjects: readonly string[],
): CategoryProposal[] {
  let raw: unknown
  try {
    raw = JSON.parse(stripCodeFence(text))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const wanted = new Set(items.map(i => i.key))
  const seen = new Set<string>()
  const proposals: CategoryProposal[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const rec = row as Record<string, unknown>
    const key = rec.key
    if (typeof key !== 'string' || !wanted.has(key) || seen.has(key)) continue
    seen.add(key)
    proposals.push({
      key,
      project: canonicalProject(rec.project, knownProjects),
      tags: parseTags(rec.tags),
      billable: typeof rec.billable === 'boolean' ? rec.billable : null,
      confidence: parseConfidence(rec.confidence),
    })
  }
  return proposals
}

export interface Categorizer {
  compose(
    items: readonly CategorizeItemInput[],
    knownProjects: readonly string[],
    opts: { allowAi: boolean },
  ): Promise<CategorizeResult>
}

export const CATEGORIZER = Symbol('CATEGORIZER')

/** The LLM-backed categorizer. Never throws on the AI path — it degrades to `none`. */
export class LlmCategorizer implements Categorizer {
  constructor(private readonly llm: LlmPort) {}

  async compose(
    items: readonly CategorizeItemInput[],
    knownProjects: readonly string[],
    opts: { allowAi: boolean },
  ): Promise<CategorizeResult> {
    if (!opts.allowAi || items.length === 0) return NONE
    const available = await this.llm.available().catch(() => false)
    if (!available) return NONE
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(items, knownProjects) }],
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
      })
      const proposals = parseProposals(result.text, items, knownProjects)
      // Nothing parseable is an honest "none" — the caller charges nothing (ADR-0008).
      if (proposals.length === 0) return NONE
      return { source: 'ai-proposal', proposals }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return NONE
      return NONE // the proposal layer never fails the request (ADR-0005)
    }
  }
}

/** Binds the `CATEGORIZER` port to the LLM-backed categorizer. */
export const categorizerProvider: Provider = {
  provide: CATEGORIZER,
  inject: [LLM],
  useFactory: (llm: LlmPort): Categorizer => new LlmCategorizer(llm),
}
