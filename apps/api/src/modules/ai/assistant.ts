import type { Provider } from '@nestjs/common'
import { isOffData, selectGroundingFacts } from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * The grounded assistant (REQ-020/flagship AI, M2, ADR-0005/0029). It answers ONLY
 * from facts the caller supplies — figures the client derived deterministically from
 * its own workspace data — and the LLM merely phrases them; it never invents a
 * number and refuses cleanly when the answer is not in the facts. Everything
 * degrades to a deterministic best-matching fact when the provider is down, so the
 * assistant always responds and never fabricates. The client passing its own facts
 * keeps the `ai` module free of `tracking`/`worktime`/`billing` coupling and
 * workspace-safe by construction (the caller only knows its own data).
 */
export interface AssistantAnswer {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly refused: boolean
  readonly text: string
}

/**
 * The always-available fallback: pick the most **relevant** fact via the deterministic grounding
 * core (IDF-weighted overlap, stopwords dropped — `packages/domain/assistant`). Pure and
 * reproducible — no model. Refuses when nothing is relevant, so the assistant never answers from
 * thin air (ADR-0005).
 */
export function deterministicAnswer(
  question: string,
  facts: readonly string[],
): { refused: boolean; text: string } {
  if (facts.length === 0)
    return { refused: true, text: "I don't have any data for that right now." }
  const [best] = selectGroundingFacts(question, facts, { maxFacts: 1 })
  if (best === undefined) {
    return { refused: true, text: "That isn't in your current data — ask more specifically." }
  }
  return { refused: false, text: best }
}

/** How many facts to ground the LLM on — the most relevant, not the whole dump. */
const MAX_GROUNDING_FACTS = 8

const REFUSAL_MARKER = 'NO_DATA'

function buildPrompt(question: string, facts: readonly string[]): string {
  return [
    'You are a sober, honest assistant. Answer the question EXCLUSIVELY',
    'from the following facts. Do not invent numbers. If the answer is not in the',
    `facts, reply exactly with "${REFUSAL_MARKER}". Answer concisely in English.`,
    '',
    'FACTS:',
    ...facts.map(f => `- ${f}`),
    '',
    `QUESTION: ${question}`,
  ].join('\n')
}

export interface Assistant {
  answer(
    question: string,
    facts: readonly string[],
    opts: { allowAi: boolean },
  ): Promise<AssistantAnswer>
}

export const ASSISTANT = Symbol('ASSISTANT')

/** The LLM-backed grounded assistant. Never throws on the AI path — it degrades. */
export class LlmAssistant implements Assistant {
  constructor(private readonly llm: LlmPort) {}

  private fallback(question: string, facts: readonly string[]): AssistantAnswer {
    const det = deterministicAnswer(question, facts)
    return { source: 'deterministic', refused: det.refused, text: det.text }
  }

  async answer(
    question: string,
    facts: readonly string[],
    opts: { allowAi: boolean },
  ): Promise<AssistantAnswer> {
    if (!opts.allowAi || facts.length === 0) return this.fallback(question, facts)
    // Off-data refusal *before* spending a model call: if nothing is relevant, the deterministic
    // path already refuses cleanly — the cheapest, cleanest way to say "not in your data".
    if (isOffData(question, facts)) return this.fallback(question, facts)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.fallback(question, facts)
    // Ground the model on the most relevant facts, not the whole dump (better answers, fewer tokens).
    const grounding = selectGroundingFacts(question, facts, { maxFacts: MAX_GROUNDING_FACTS })
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(question, grounding) }],
        maxOutputTokens: 300,
        temperature: 0.2,
      })
      const text = result.text.trim()
      if (text.length === 0) return this.fallback(question, facts)
      if (text.includes(REFUSAL_MARKER)) {
        return {
          source: 'ai-proposal',
          refused: true,
          text: "That isn't in your current data.",
        }
      }
      return { source: 'ai-proposal', refused: false, text }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.fallback(question, facts)
      return this.fallback(question, facts)
    }
  }
}

/** Binds the `ASSISTANT` port to the LLM-backed grounded assistant. */
export const assistantProvider: Provider = {
  provide: ASSISTANT,
  inject: [LLM],
  useFactory: (llm: LlmPort): Assistant => new LlmAssistant(llm),
}
