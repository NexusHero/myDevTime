import { Inject, Injectable } from '@nestjs/common'
import { parseTimeEntry, type TimeEntryDraft } from '@mydevtime/domain'
import { LLM } from './llm/llm.provider.js'
import { LlmUnavailableError, type LlmPort } from './llm/port.js'

/**
 * Natural-language time entry (REQ-013, ADR-0005/0029). Tries the deterministic
 * pre-parser first; only what it can't parse falls to the LLM — and even then the
 * result is a **draft the user confirms**, never a persisted entry. When the LLM
 * is unavailable (the `NullLlm` default), the service degrades to "couldn't
 * parse" rather than failing, so capture never depends on a provider being up.
 */
export type DraftSource = 'deterministic' | 'ai-proposal' | 'none'

export interface DraftResult {
  readonly draft: TimeEntryDraft | null
  readonly source: DraftSource
}

@Injectable()
export class NlEntryService {
  constructor(@Inject(LLM) private readonly llm: LlmPort) {}

  async draft(text: string): Promise<DraftResult> {
    const deterministic = parseTimeEntry(text)
    if (deterministic) return { draft: deterministic, source: 'deterministic' }

    // The deterministic parser found no duration — the LLM may still read it. The
    // response is parsed back through the same deterministic parser so an entry
    // never bypasses the core (ADR-0005); a provider outage degrades to `none`.
    if (!(await this.llm.available())) return { draft: null, source: 'none' }
    try {
      const result = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content:
              'Rewrite the user note as a single time-tracking phrase of the form ' +
              '"<duration> <project> <note> [today|yesterday]". Reply with only that phrase.',
          },
          { role: 'user', content: text },
        ],
        maxOutputTokens: 60,
        temperature: 0,
      })
      const reparsed = parseTimeEntry(result.text)
      return reparsed ? { draft: reparsed, source: 'ai-proposal' } : { draft: null, source: 'none' }
    } catch (err) {
      if (err instanceof LlmUnavailableError) return { draft: null, source: 'none' }
      throw err
    }
  }
}
