import { describe, expect, it } from 'vitest'
import type { DayPlan } from '@mydevtime/domain'
import { NullLlm } from '../ai/llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmResult } from '../ai/llm/port.js'
import { DeterministicPlanBriefer, LlmPlanBriefer, deterministicBriefing } from './briefer.js'

/**
 * The AI day-briefing (M8): the LLM writes a short coaching text over the placed
 * plan and always degrades to a factual deterministic summary — a down, throwing,
 * or empty provider never fails the call (ADR-0005/0011/0029).
 */
const plan: DayPlan = {
  dayStartMin: 480,
  dayEndMin: 1020,
  plannedFocusMin: 330,
  unplacedMin: 270,
  droppedAnchors: [{ startMin: 540, lenMin: 30, label: 'Vendor call' }],
  blocks: [
    { startMin: 480, lenMin: 30, kind: 'meeting', label: 'Standup' },
    { startMin: 510, lenMin: 90, kind: 'focus', label: 'Sync engine' },
    { startMin: 600, lenMin: 60, kind: 'focus', label: 'Reviews' },
  ],
}

function fakeLlm(text: string): LlmPort {
  const result: LlmResult = {
    text,
    usage: { inputTokens: 1, outputTokens: 1 },
    provider: 'openai',
    model: 'x',
  }
  return {
    provider: 'openai',
    available: () => Promise.resolve(true),
    complete: () => Promise.resolve(result),
  }
}

describe('deterministicBriefing', () => {
  it('SummarisesFocusMeetingsDroppedAndUnplaced', () => {
    const text = deterministicBriefing(plan)
    expect(text).toContain('5 h 30 min of focus')
    expect(text).toContain('1 meeting') // meetings count
    expect(text).toContain('overlaps')
    expect(text).toContain('4 h 30 min of backlog')
  })

  it('IsReproducible', () => {
    expect(deterministicBriefing(plan)).toBe(deterministicBriefing(plan))
  })
})

describe('LlmPlanBriefer', () => {
  it('NullLlm_DegradesToDeterministic', async () => {
    const out = await new LlmPlanBriefer(new NullLlm()).brief(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
    expect(out.text.length).toBeGreaterThan(0)
  })

  it('AllowAiFalse_SkipsTheProvider', async () => {
    let called = false
    const spy: LlmPort = {
      provider: 'openai',
      available: () => {
        called = true
        return Promise.resolve(true)
      },
      complete: () => Promise.reject(new Error('nope')),
    }
    const out = await new LlmPlanBriefer(spy).brief(plan, { allowAi: false })
    expect(out.source).toBe('deterministic')
    expect(called).toBe(false)
  })

  it('ValidCompletion_YieldsAiProposalText', async () => {
    const out = await new LlmPlanBriefer(fakeLlm('Packed day — move the Vendor Call.')).brief(
      plan,
      { allowAi: true },
    )
    expect(out.source).toBe('ai-proposal')
    expect(out.text).toBe('Packed day — move the Vendor Call.')
  })

  it('EmptyCompletion_FallsBackToDeterministic', async () => {
    const out = await new LlmPlanBriefer(fakeLlm('   ')).brief(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })

  it('ThrownProvider_FallsBackToDeterministic', async () => {
    const flaky: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new LlmUnavailableError('openai')),
    }
    const out = await new LlmPlanBriefer(flaky).brief(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })
})

describe('DeterministicPlanBriefer', () => {
  it('AlwaysReturnsDeterministic', async () => {
    const out = await new DeterministicPlanBriefer().brief(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })
})
