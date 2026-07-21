// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'

/**
 * The mood-pattern hook (REQ-068, ADR-0071): the consented mood history runs through the pure
 * domain `moodPatterns` core; the note helper turns the first flagged weekday into ONE calm,
 * localised line. The api module is mocked so the tests pin the client contract: an empty
 * (consent-off) history and a failing read both resolve to the honest "not enough data" empty
 * pattern — never an invented one.
 */
const { getMoodHistory } = vi.hoisted(() => ({ getMoodHistory: vi.fn() }))
vi.mock('../api/mood.js', () => ({ getMoodHistory }))
vi.mock('../config.js', () => ({ apiBaseUrl: 'https://api.test' }))

const { useMoodPattern, moodPatternNote } = await import('./useMoodPattern.js')

type HookValue = ReturnType<typeof useMoodPattern>

function Probe({ out }: { readonly out: { value: HookValue | null } }): null {
  out.value = useMoodPattern()
  return null
}

async function renderHook(): Promise<{ value: HookValue | null }> {
  const out: { value: HookValue | null } = { value: null }
  await act(async () => {
    TestRenderer.create(<Probe out={out} />)
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return out
}

describe('useMoodPattern', () => {
  it('ThreeTenseTuesdays_YieldTheTuesdayPattern', async () => {
    // 2026-06-30 / 07-07 / 07-14 are consecutive Tuesdays (UTC weekday 2).
    getMoodHistory.mockResolvedValueOnce([
      { day: '2026-07-14', mood: 'tense' },
      { day: '2026-07-07', mood: 'tense' },
      { day: '2026-06-30', mood: 'tense' },
    ])
    const out = await renderHook()
    expect(out.value?.loading).toBe(false)
    expect(out.value?.pattern).toEqual({
      lowWeekdays: [{ weekday: 2, medianMood: 2 }],
      enoughData: true,
    })
  })

  it('EmptyHistory_ConsentOffOrNothingStored_YieldsNotEnoughData', async () => {
    getMoodHistory.mockResolvedValueOnce([])
    const out = await renderHook()
    expect(out.value?.pattern).toEqual({ lowWeekdays: [], enoughData: false })
  })

  it('FailingHistoryRead_DegradesToTheEmptyPattern', async () => {
    getMoodHistory.mockRejectedValueOnce(new Error('offline'))
    const out = await renderHook()
    expect(out.value?.loading).toBe(false)
    expect(out.value?.pattern).toEqual({ lowWeekdays: [], enoughData: false })
  })
})

describe('moodPatternNote', () => {
  it('FirstLowWeekday_BecomesOneCalmLocalisedLine', () => {
    // jsdom's navigator.language is en-US → the English phrasing.
    expect(
      moodPatternNote({ lowWeekdays: [{ weekday: 2, medianMood: 2 }], enoughData: true }),
    ).toBe('Tuesdays often tense')
  })

  it('NoLowWeekday_YieldsNoNote', () => {
    expect(moodPatternNote({ lowWeekdays: [], enoughData: true })).toBeNull()
    expect(moodPatternNote({ lowWeekdays: [], enoughData: false })).toBeNull()
  })
})
