import type { Provider } from '@nestjs/common'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * The v13 grounded AI difference-makers (REQ-054, ADR-0065 · KI1–KI4). Four features
 * that turn the user's *own* deterministic facts into a phrased proposal: a **Drift
 * Coach** (KI1), a **quote** grounded in history (KI2, the number comes from the domain
 * estimator), an **invoice translator** dev-jargon→client-prose (KI3), and **meeting
 * follow-ups** (KI4). Every one obeys the house rules (ADR-0005/0029): the LLM only
 * phrases facts the caller supplies, never invents, refuses cleanly when the facts don't
 * cover the ask, and degrades to a deterministic fallback when the provider is down — so
 * the feature always responds. The result is always marked `ai-proposal` vs
 * `deterministic` so the UI can wear the AI signature only on real model output.
 */

export type InsightKind = 'coach' | 'quote' | 'invoice' | 'meeting'

export interface InsightProposal {
  readonly kind: InsightKind
  readonly source: 'deterministic' | 'ai-proposal'
  readonly refused: boolean
  readonly text: string
}

const REFUSAL_MARKER = 'NO_DATA'

/** Config for one grounded feature: how to frame it, and its deterministic fallback. */
interface InsightSpec {
  readonly kind: InsightKind
  readonly system: string
  readonly fallback: (facts: readonly string[]) => { refused: boolean; text: string }
}

/** KI1 fallback: surface the single sharpest drift fact with a gentle, generic nudge. */
export function coachFallback(facts: readonly string[]): { refused: boolean; text: string } {
  if (facts.length === 0) return { refused: true, text: "No plan-vs-actual data to coach on yet." }
  return {
    refused: false,
    text: `${facts[0] ?? ''} — consider adjusting tomorrow's plan to match how the day really goes.`,
  }
}

/** KI2 fallback: state the grounded estimate plainly (the number is already in the facts). */
export function quoteFallback(facts: readonly string[]): { refused: boolean; text: string } {
  if (facts.length === 0)
    return { refused: true, text: "No comparable history — I can't ground a quote yet." }
  return { refused: false, text: facts.join(' ') }
}

/** KI3 fallback: a faithful cleanup — strip a leading ticket key, tidy spacing, capitalise. */
export function invoiceFallback(items: readonly string[]): { refused: boolean; text: string } {
  const cleaned = items
    .map(raw => raw.replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, '').replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .map(line => line.charAt(0).toUpperCase() + line.slice(1))
  if (cleaned.length === 0) return { refused: true, text: 'No entries to translate.' }
  return { refused: false, text: cleaned.join('\n') }
}

/** KI4 fallback: an honest minimal next step rather than an invented action list. */
export function meetingFallback(facts: readonly string[]): { refused: boolean; text: string } {
  if (facts.length === 0) return { refused: true, text: 'No meeting notes to work from.' }
  return { refused: false, text: '- Review the meeting notes and confirm the next steps.' }
}

const SPECS: Record<InsightKind, InsightSpec> = {
  coach: {
    kind: 'coach',
    system:
      'You are a supportive, concrete time-coach. From these plan-vs-actual facts, give ONE ' +
      'short, kind, actionable suggestion. Do not invent numbers.',
    fallback: coachFallback,
  },
  quote: {
    kind: 'quote',
    system:
      'Phrase a short, client-facing project quote grounded EXCLUSIVELY in these facts (they ' +
      'already contain the estimate derived from history). Do not invent numbers or ranges.',
    fallback: quoteFallback,
  },
  invoice: {
    kind: 'invoice',
    system:
      'Rewrite each developer work note as a clear, professional, client-friendly invoice line ' +
      'item. Stay faithful to what was done; invent nothing. Output one line per item.',
    fallback: invoiceFallback,
  },
  meeting: {
    kind: 'meeting',
    system:
      'From these meeting notes, propose up to 3 concrete follow-up actions as short bullets ' +
      'starting with "- ". Base them only on the notes; invent nothing.',
    fallback: meetingFallback,
  },
}

function buildPrompt(system: string, facts: readonly string[]): string {
  return [
    system,
    `If the facts do not support an answer, reply exactly with "${REFUSAL_MARKER}". Answer in English.`,
    '',
    'FACTS:',
    ...facts.map(f => `- ${f}`),
  ].join('\n')
}

export interface AiInsightsPort {
  propose(kind: InsightKind, facts: readonly string[], opts: { allowAi: boolean }): Promise<InsightProposal>
}

export const AI_INSIGHTS = Symbol('AI_INSIGHTS')

/** LLM-backed grounded insights. Never throws on the AI path — it degrades cleanly. */
export class LlmInsights implements AiInsightsPort {
  constructor(private readonly llm: LlmPort) {}

  private degrade(spec: InsightSpec, facts: readonly string[]): InsightProposal {
    const f = spec.fallback(facts)
    return { kind: spec.kind, source: 'deterministic', refused: f.refused, text: f.text }
  }

  async propose(
    kind: InsightKind,
    facts: readonly string[],
    opts: { allowAi: boolean },
  ): Promise<InsightProposal> {
    const spec = SPECS[kind]
    if (!opts.allowAi || facts.length === 0) return this.degrade(spec, facts)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.degrade(spec, facts)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(spec.system, facts) }],
        maxOutputTokens: 320,
        temperature: 0.3,
      })
      const text = result.text.trim()
      if (text.length === 0) return this.degrade(spec, facts)
      if (text.includes(REFUSAL_MARKER)) {
        return { kind, source: 'ai-proposal', refused: true, text: "That isn't in your data." }
      }
      return { kind, source: 'ai-proposal', refused: false, text }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.degrade(spec, facts)
      return this.degrade(spec, facts)
    }
  }
}

/** Binds the `AI_INSIGHTS` port to the LLM-backed grounded insights. */
export const aiInsightsProvider: Provider = {
  provide: AI_INSIGHTS,
  inject: [LLM],
  useFactory: (llm: LlmPort): AiInsightsPort => new LlmInsights(llm),
}
