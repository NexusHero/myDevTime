import type { Provider } from '@nestjs/common'
import {
  buildStandup,
  renderStandupPlain,
  slotsPreserved,
  standupSlots,
  type StandupInput,
  type StandupReport,
} from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * The AI **standup / summary** writer (REQ-014, ADR-0005). The deterministic core (`buildStandup`)
 * arranges the caller's own tracked durations into a report with **fixed numeric slots**; the LLM
 * may narrate *around* those numbers but can never change one. Every AI draft is checked with
 * `slotsPreserved` — if the model dropped or altered any figure the draft is rejected and we fall
 * back to the plain template, so a booked-looking number is never fabricated. When the provider is
 * down (or credits are exhausted) the always-available `renderStandupPlain` is returned and nothing
 * is charged. The caller supplies its own grouped facts, keeping the `ai` module free of
 * `tracking`/`worktime` coupling and workspace-safe by construction.
 */
export interface StandupResult {
  readonly source: 'deterministic' | 'ai-proposal'
  readonly text: string
  /** The structured report the text is grounded in (numbers the client can render itself). */
  readonly report: StandupReport
}

const MAX_OUTPUT_TOKENS = 400

function buildPrompt(report: StandupReport): string {
  const plain = renderStandupPlain(report)
  const slots = standupSlots(report)
  return [
    'You are a sober engineering-standup writer. Rewrite the report below as a short,',
    'natural standup update (a few sentences, first person). You MUST keep every one of',
    'these duration figures EXACTLY as written, unchanged:',
    slots.map(s => `"${s}"`).join(', '),
    'Do not invent tasks, numbers, or blockers that are not in the report. Be concise.',
    '',
    'REPORT:',
    plain,
  ].join('\n')
}

export interface StandupWriter {
  compose(input: StandupInput, opts: { allowAi: boolean }): Promise<StandupResult>
}

export const STANDUP_WRITER = Symbol('STANDUP_WRITER')

/** The LLM-backed standup writer. Never throws on the AI path — it degrades to the plain template. */
export class LlmStandupWriter implements StandupWriter {
  constructor(private readonly llm: LlmPort) {}

  private plain(report: StandupReport): StandupResult {
    return { source: 'deterministic', text: renderStandupPlain(report), report }
  }

  async compose(input: StandupInput, opts: { allowAi: boolean }): Promise<StandupResult> {
    const report = buildStandup(input)
    // Nothing tracked → the plain template already says so; a model call would add nothing.
    const empty = report.yesterday.length === 0 && report.today.length === 0
    if (!opts.allowAi || empty) return this.plain(report)
    const available = await this.llm.available().catch(() => false)
    if (!available) return this.plain(report)
    try {
      const result = await this.llm.complete({
        messages: [{ role: 'user', content: buildPrompt(report) }],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.3,
      })
      const text = result.text.trim()
      // Slot integrity (ADR-0005): a draft that dropped or altered any figure is not trustworthy —
      // fall back to the plain template rather than surface a wrong number.
      if (text.length === 0 || !slotsPreserved(text, report)) return this.plain(report)
      return { source: 'ai-proposal', text, report }
    } catch (error) {
      if (error instanceof LlmUnavailableError) return this.plain(report)
      return this.plain(report)
    }
  }
}

/** Binds the `STANDUP_WRITER` port to the LLM-backed writer. */
export const standupWriterProvider: Provider = {
  provide: STANDUP_WRITER,
  inject: [LLM],
  useFactory: (llm: LlmPort): StandupWriter => new LlmStandupWriter(llm),
}
