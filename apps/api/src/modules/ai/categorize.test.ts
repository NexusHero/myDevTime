import { describe, expect, it } from 'vitest'
import { LlmCategorizer } from './categorize.js'
import { LlmUnavailableError, type LlmPort, type LlmRequest, type LlmResult } from './llm/port.js'

/**
 * The LLM categorizer (REQ-012, #17 · ADR-0005): proposals only, a project strictly out of
 * `knownProjects` (canonical spelling, case-insensitive — never invented), and every failure
 * mode (down provider, malformed JSON, AI withheld) degrades to `none` so nothing upstream
 * ever charges for output the AI didn't produce (ADR-0008).
 */
class FakeLlm implements LlmPort {
  readonly provider = 'openai' as const
  constructor(
    private up: boolean,
    private reply: string,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  complete(_req: LlmRequest): Promise<LlmResult> {
    if (!this.up) return Promise.reject(new LlmUnavailableError('openai', 'down'))
    return Promise.resolve({
      text: this.reply,
      usage: { inputTokens: 1, outputTokens: 1 },
      provider: 'openai',
      model: 'fake',
    })
  }
}

const ITEMS = [{ key: 'e1', note: 'finanzo dashboard review', source: 'calendar' }]
const KNOWN = ['Finanzo', 'Sync Engine']

describe('LlmCategorizer', () => {
  it('ValidJson_YieldsProposalsWithCanonicalProjectSpelling', async () => {
    // The model answers lowercase — the proposal carries the canonical knownProjects spelling.
    const reply =
      '[{"key":"e1","project":"finanzo","tags":["review","dashboard"],"billable":true,"confidence":"high"}]'
    const res = await new LlmCategorizer(new FakeLlm(true, reply)).compose(ITEMS, KNOWN, {
      allowAi: true,
    })
    expect(res.source).toBe('ai-proposal')
    expect(res.proposals).toHaveLength(1)
    expect(res.proposals[0]).toEqual({
      key: 'e1',
      project: 'Finanzo',
      tags: ['review', 'dashboard'],
      billable: true,
      confidence: 'high',
    })
  })

  it('FencedJson_IsParsed', async () => {
    // Gemini-style: valid JSON wrapped in a markdown fence must not degrade the paid feature.
    const reply =
      '```json\n[{"key":"e1","project":"Finanzo","tags":[],"billable":false,"confidence":"medium"}]\n```'
    const res = await new LlmCategorizer(new FakeLlm(true, reply)).compose(ITEMS, KNOWN, {
      allowAi: true,
    })
    expect(res.source).toBe('ai-proposal')
    expect(res.proposals[0]?.project).toBe('Finanzo')
    expect(res.proposals[0]?.confidence).toBe('medium')
  })

  it('UnknownProject_IsNulledNeverInvented', async () => {
    const reply =
      '[{"key":"e1","project":"Atlantis","tags":["misc"],"billable":true,"confidence":"high"}]'
    const res = await new LlmCategorizer(new FakeLlm(true, reply)).compose(ITEMS, KNOWN, {
      allowAi: true,
    })
    expect(res.source).toBe('ai-proposal')
    expect(res.proposals[0]?.project).toBeNull()
  })

  it('MalformedJson_DegradesToNone', async () => {
    const res = await new LlmCategorizer(
      new FakeLlm(true, 'Sure! Here is the categorization:'),
    ).compose(ITEMS, KNOWN, { allowAi: true })
    expect(res.source).toBe('none')
    expect(res.proposals).toEqual([])
  })

  it('MalformedRows_AreIgnored_ValidOnesKept', async () => {
    // A row without a key, a row for a key that was never asked, and a valid one.
    const reply =
      '[{"project":"Finanzo"},{"key":"ghost","project":"Finanzo","tags":[],"billable":true,"confidence":"low"},' +
      '{"key":"e1","project":"sync engine","tags":[],"billable":false,"confidence":"nonsense"}]'
    const res = await new LlmCategorizer(new FakeLlm(true, reply)).compose(ITEMS, KNOWN, {
      allowAi: true,
    })
    expect(res.proposals).toHaveLength(1)
    expect(res.proposals[0]?.key).toBe('e1')
    expect(res.proposals[0]?.project).toBe('Sync Engine')
    // An out-of-range confidence defaults to the honest 'low'.
    expect(res.proposals[0]?.confidence).toBe('low')
  })

  it('AllowAiFalse_DegradesToNoneWithoutCallingTheModel', async () => {
    const spy: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new Error('should not run')),
    }
    const res = await new LlmCategorizer(spy).compose(ITEMS, KNOWN, { allowAi: false })
    expect(res.source).toBe('none')
    expect(res.proposals).toEqual([])
  })

  it('ProviderDown_DegradesToNone', async () => {
    const res = await new LlmCategorizer(new FakeLlm(false, 'unused')).compose(ITEMS, KNOWN, {
      allowAi: true,
    })
    expect(res.source).toBe('none')
  })

  it('EmptyItems_DegradesToNoneWithoutCallingTheModel', async () => {
    const spy: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new Error('should not run')),
    }
    const res = await new LlmCategorizer(spy).compose([], KNOWN, { allowAi: true })
    expect(res.source).toBe('none')
  })
})
