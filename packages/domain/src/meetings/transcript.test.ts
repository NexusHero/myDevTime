import { describe, expect, it } from 'vitest'
import {
  actionItemProposals,
  transcriptFacts,
  transcriptText,
  type TranscriptSegment,
} from './transcript.js'

const seg = (startMs: number, text: string, speaker?: string): TranscriptSegment => ({
  startMs,
  endMs: startMs + 1000,
  text,
  ...(speaker !== undefined ? { speaker } : {}),
})

describe('transcriptText', () => {
  it('JoinsSegmentsInTimeOrder_droppingEmpties', () => {
    const out = transcriptText([seg(2000, 'second'), seg(1000, 'first'), seg(3000, '   ')])
    expect(out).toBe('first\nsecond')
  })
})

describe('transcriptFacts', () => {
  it('SurfacesActionLikeLinesFirst', () => {
    const segments = [
      seg(1000, 'We talked about the roadmap'),
      seg(2000, 'TODO: send the report to the client'),
    ]
    const facts = transcriptFacts(segments)
    expect(facts[0]).toContain('send the report')
  })

  it('EmptyTranscript_HasNoFacts', () => {
    expect(transcriptFacts([])).toEqual([])
  })
})

describe('actionItemProposals', () => {
  it('ProposesActionItems_confirmedFalse_aiProvenance', () => {
    const segments = [
      seg(1000, 'General chat about the weather'),
      seg(2000, 'Action: Alice will review the PR'),
      seg(3000, 'We should schedule a follow-up'),
    ]
    const items = actionItemProposals(segments)
    expect(items.length).toBeGreaterThanOrEqual(2)
    for (const item of items) {
      expect(item.source).toBe('ai-proposal')
      expect(item.confirmed).toBe(false)
    }
    expect(items.some(i => i.text.includes('review the PR'))).toBe(true)
  })

  it('OnlyActionLikeLines_notEveryUtterance', () => {
    const items = actionItemProposals([seg(1000, 'Just some small talk, nothing to do')])
    expect(items).toEqual([])
  })

  it('RespectsTheMaxCap', () => {
    const segments = Array.from({ length: 20 }, (_, i) =>
      seg(i * 1000, `TODO task number ${String(i)}`),
    )
    expect(actionItemProposals(segments, { max: 3 })).toHaveLength(3)
  })

  it('EmptyTranscript_NoProposals', () => {
    expect(actionItemProposals([])).toEqual([])
  })
})
