import { describe, expect, it } from 'vitest'
import type { DayPlan } from '@mydevtime/domain'
import { NullLlm } from '../ai/llm/null-llm.js'
import { LlmUnavailableError, type LlmPort, type LlmResult } from '../ai/llm/port.js'
import { DeterministicPlanLabeler, LlmPlanLabeler } from './labeler.js'

/**
 * The Co-Planner label port (#151): the LLM only ranks/labels the code-enforced
 * blocks and always degrades to the deterministic labels — a down, throwing, or
 * malformed provider never fails the call (ADR-0005/0011).
 */
const plan: DayPlan = {
  dayStartMin: 480,
  dayEndMin: 1020,
  plannedFocusMin: 150,
  unplacedMin: 0,
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

describe('DeterministicPlanLabeler', () => {
  it('AlwaysReturnsDeterministicLabels', async () => {
    const out = await new DeterministicPlanLabeler().label(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
    expect(out.labels).toHaveLength(3)
    expect(out.labels[1]).toEqual({ blockIndex: 1, note: 'Fokus 1: Sync engine', rank: 1 })
  })
})

describe('LlmPlanLabeler', () => {
  it('NullLlm_DegradesToDeterministic', async () => {
    const out = await new LlmPlanLabeler(new NullLlm()).label(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })

  it('AllowAiFalse_SkipsTheProviderEntirely', async () => {
    let called = false
    const spy: LlmPort = {
      provider: 'openai',
      available: () => {
        called = true
        return Promise.resolve(true)
      },
      complete: () => Promise.reject(new Error('should not be called')),
    }
    const out = await new LlmPlanLabeler(spy).label(plan, { allowAi: false })
    expect(out.source).toBe('deterministic')
    expect(called).toBe(false)
  })

  it('ValidCompletion_YieldsAiProposalLabels', async () => {
    const json = JSON.stringify([
      { blockIndex: 0, note: 'Termin: Standup', rank: 0 },
      { blockIndex: 1, note: 'Tiefe Arbeit zuerst', rank: 1 },
      { blockIndex: 2, note: 'Reviews danach', rank: 2 },
    ])
    const out = await new LlmPlanLabeler(fakeLlm(json)).label(plan, { allowAi: true })
    expect(out.source).toBe('ai-proposal')
    expect(out.labels[1]).toEqual({ blockIndex: 1, note: 'Tiefe Arbeit zuerst', rank: 1 })
  })

  it('MalformedCompletion_FallsBackToDeterministic', async () => {
    const out = await new LlmPlanLabeler(fakeLlm('not json at all')).label(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })

  it('WrongLengthCompletion_FallsBackToDeterministic', async () => {
    const out = await new LlmPlanLabeler(fakeLlm('[{"blockIndex":0,"note":"x","rank":0}]')).label(
      plan,
      { allowAi: true },
    )
    expect(out.source).toBe('deterministic')
  })

  it('ThrownProvider_FallsBackToDeterministic', async () => {
    const flaky: LlmPort = {
      provider: 'openai',
      available: () => Promise.resolve(true),
      complete: () => Promise.reject(new LlmUnavailableError('openai')),
    }
    const out = await new LlmPlanLabeler(flaky).label(plan, { allowAi: true })
    expect(out.source).toBe('deterministic')
  })
})
