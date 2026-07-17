import { describe, expect, it } from 'vitest'
import type { SmartEntryDraft } from '@mydevtime/domain'
import { parseSmartAddResult, resolveDraftDay, smartDraftToEntryTimes } from './smartAdd.js'

/** The Smart-Add client parser (K6): tolerant shape reader over the /api/ai/smart-add body. */
describe('parseSmartAddResult', () => {
  const draft = {
    kind: 'meeting',
    title: 'standup',
    projectHint: null,
    ticketKey: null,
    dayOffset: 0,
    startMin: 540,
    endMin: 555,
    durationMs: null,
    billable: true,
    confidence: 0.8,
    needsAi: false,
  }

  it('ReadsATypedDraftWithSourceAndCharge', () => {
    const r = parseSmartAddResult({ draft, source: 'deterministic', charged: false })
    expect(r.draft.kind).toBe('meeting')
    expect(r.draft.startMin).toBe(540)
    expect(r.source).toBe('deterministic')
    expect(r.charged).toBe(false)
  })

  it('CarriesTheAiProposalSourceAndCharge', () => {
    const r = parseSmartAddResult({
      draft: { ...draft, kind: 'task' },
      source: 'ai-proposal',
      charged: true,
    })
    expect(r.source).toBe('ai-proposal')
    expect(r.charged).toBe(true)
  })

  it('RejectsAnUnknownKind', () => {
    expect(() =>
      parseSmartAddResult({ draft: { ...draft, kind: 'nonsense' }, source: 'deterministic' }),
    ).toThrow()
  })
})

describe('resolveDraftDay', () => {
  const now = new Date(2026, 2, 4, 10, 0, 0) // Wed 2026-03-04, local

  it('HandlesRelativeOffsets', () => {
    expect(resolveDraftDay(0, now).getDate()).toBe(4)
    expect(resolveDraftDay(-1, now).getDate()).toBe(3)
    expect(resolveDraftDay(1, now).getDate()).toBe(5)
  })

  it('ResolvesANamedWeekdayToTheNearestUpcoming', () => {
    // Wed=index2 → today; Fri=index4 → +2 days = the 6th.
    expect(resolveDraftDay(100 + 2, now).getDate()).toBe(4)
    expect(resolveDraftDay(100 + 4, now).getDate()).toBe(6)
    // Monday (index0) is next week → +5 = the 9th.
    expect(resolveDraftDay(100 + 0, now).getDate()).toBe(9)
  })
})

describe('smartDraftToEntryTimes', () => {
  const base: SmartEntryDraft = {
    kind: 'task',
    title: 't',
    projectHint: null,
    ticketKey: null,
    dayOffset: 0,
    startMin: null,
    endMin: null,
    durationMs: null,
    billable: true,
    confidence: 0.5,
    needsAi: false,
  }
  const now = new Date(2026, 2, 4, 14, 0, 0)

  it('UsesAClockRangeForBothEnds', () => {
    const { startedAt, endedAt } = smartDraftToEntryTimes(
      { ...base, kind: 'meeting', startMin: 9 * 60, endMin: 9 * 60 + 30 },
      now,
    )
    expect(new Date(startedAt).getHours()).toBe(9)
    expect(new Date(endedAt).getMinutes()).toBe(30)
  })

  it('ExtendsAStartByADuration', () => {
    const { startedAt, endedAt } = smartDraftToEntryTimes(
      { ...base, startMin: 10 * 60, durationMs: 90 * 60_000 },
      now,
    )
    expect(new Date(startedAt).getHours()).toBe(10)
    expect(new Date(endedAt).getHours()).toBe(11)
    expect(new Date(endedAt).getMinutes()).toBe(30)
  })

  it('EndsABareTodayDurationAtNow', () => {
    const { endedAt } = smartDraftToEntryTimes({ ...base, durationMs: 60 * 60_000 }, now)
    expect(new Date(endedAt).getTime()).toBe(now.getTime())
  })

  it('EndsAPastDayDurationAt17h', () => {
    const { endedAt } = smartDraftToEntryTimes(
      { ...base, dayOffset: -1, durationMs: 60 * 60_000 },
      now,
    )
    expect(new Date(endedAt).getHours()).toBe(17)
    expect(new Date(endedAt).getDate()).toBe(3)
  })
})
