import type { Provider } from '@nestjs/common'
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

/** Lowercased word tokens ≥ 3 chars (German/English), for keyword overlap scoring. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 3)
}

/**
 * The always-available fallback: pick the fact with the most word-overlap with the
 * question. Pure and reproducible — no model. Refuses when nothing overlaps, so the
 * assistant never answers from thin air (ADR-0005).
 */
export function deterministicAnswer(
  question: string,
  facts: readonly string[],
): { refused: boolean; text: string } {
  if (facts.length === 0) return { refused: true, text: 'Dazu habe ich gerade keine Daten.' }
  const qWords = new Set(tokenize(question))
  let best = facts[0] ?? ''
  let bestScore = -1
  for (const fact of facts) {
    const score = tokenize(fact).filter(w => qWords.has(w)).length
    if (score > bestScore) {
      bestScore = score
      best = fact
    }
  }
  if (bestScore <= 0) {
    return { refused: true, text: "That isn't in your current data — ask more specifically." }
  }
  return { refused: false, text: best }
}

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
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.fallback(question, facts)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(question, facts) }],
        maxOutputTokens: 300,
        temperature: 0.2,
      })
      const text = result.text.trim()
      if (text.length === 0) return this.fallback(question, facts)
      if (text.includes(REFUSAL_MARKER)) {
        return {
          source: 'ai-proposal',
          refused: true,
          text: 'Das steht nicht in deinen aktuellen Daten.',
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
