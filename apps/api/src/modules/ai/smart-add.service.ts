import { Inject, Injectable } from '@nestjs/common'
import { parseEntry, type SmartEntryDraft } from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * Smart-Add Stage 2 (REQ-047, ADR-0065 · design v13 K6). The deterministic `parseEntry`
 * (Stage 1) classifies most phrases on its own; only a genuinely vague one (`needsAi`)
 * falls to the grounded LLM. Even then the model just **rewrites** the phrase into a
 * canonical quick-add sentence which is re-parsed by the same deterministic core, so a
 * draft never bypasses the rules (ADR-0005). A provider outage degrades to the Stage-1
 * draft — capture never depends on the LLM being up.
 */
export type SmartAddSource = 'deterministic' | 'ai-proposal'

export interface SmartAddResult {
  readonly draft: SmartEntryDraft
  readonly source: SmartAddSource
}

@Injectable()
export class SmartAddService {
  constructor(@Inject(LLM) private readonly llm: LlmPort) {}

  async draft(
    text: string,
    knownProjects: readonly string[] = [],
    opts: { allowAi?: boolean } = {},
  ): Promise<SmartAddResult> {
    const stage1 = parseEntry(text, { knownProjects })
    if (!stage1.needsAi) return { draft: stage1, source: 'deterministic' }
    if (opts.allowAi === false) return { draft: stage1, source: 'deterministic' }
    if (!(await this.llm.available().catch(() => false))) {
      return { draft: stage1, source: 'deterministic' }
    }
    try {
      const result = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content:
              'Rewrite the note as ONE short quick-add phrase for a time tracker, naming the ' +
              'kind of entry where clear (a task, a meeting, an absence like vacation/sick, ' +
              'travel, or a private appointment), any time or duration, and the project or ' +
              'ticket. Reply with only that phrase; invent nothing.',
          },
          { role: 'user', content: text },
        ],
        maxOutputTokens: 60,
        temperature: 0,
      })
      const rewritten = result.text.trim()
      if (rewritten.length === 0) return { draft: stage1, source: 'deterministic' }
      const reparsed = parseEntry(rewritten, { knownProjects })
      return { draft: reparsed, source: 'ai-proposal' }
    } catch (err) {
      if (err instanceof LlmUnavailableError) return { draft: stage1, source: 'deterministic' }
      throw err
    }
  }
}
