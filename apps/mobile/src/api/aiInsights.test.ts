import { describe, expect, it } from 'vitest'
import { parseInsightProposal } from './aiInsights.js'

/** The AI-insight client parser (KI1–KI4): reads kind/source/refused/text/charged. */
describe('parseInsightProposal', () => {
  it('ReadsAnAiProposal', () => {
    const p = parseInsightProposal({
      kind: 'coach',
      source: 'ai-proposal',
      refused: false,
      text: 'Try planning 8h tomorrow.',
      charged: true,
    })
    expect(p.kind).toBe('coach')
    expect(p.source).toBe('ai-proposal')
    expect(p.charged).toBe(true)
    expect(p.refused).toBe(false)
  })

  it('ReadsADeterministicRefusal', () => {
    const p = parseInsightProposal({
      kind: 'quote',
      source: 'deterministic',
      refused: true,
      text: 'No comparable history.',
      charged: false,
    })
    expect(p.refused).toBe(true)
    expect(p.charged).toBe(false)
  })
})
