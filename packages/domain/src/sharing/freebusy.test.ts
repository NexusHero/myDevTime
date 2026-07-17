import { describe, expect, it } from 'vitest'
import { freeGaps, toFreeBusy, type OwnerBlock } from './freebusy.js'

const H = 60 * 60 * 1000
/** A day anchor (arbitrary epoch-ms; determinism is what matters, not the wall date). */
const T0 = 1_700_000_000_000

describe('toFreeBusy', () => {
  it('RedactsEveryPrivateField_leavingOnlyBusyIntervals', () => {
    const blocks: OwnerBlock[] = [
      {
        startMs: T0,
        endMs: T0 + H,
        title: 'Salary review with Anna',
        projectId: 'p-secret',
        note: 'ask for a raise',
        protectedFlag: true,
      },
    ]
    const slots = toFreeBusy(blocks)
    expect(slots).toEqual([{ startMs: T0, endMs: T0 + H, state: 'busy' }])
  })

  it('NoTitleCanLeak_evenThroughSerialization', () => {
    // The negative isolation test: a private string must not appear anywhere in what a
    // partner-light viewer receives, no matter how it is serialized.
    const secret = 'Salary review with Anna'
    const slots = toFreeBusy([
      { startMs: T0, endMs: T0 + H, title: secret, projectId: secret, note: secret },
    ])
    expect(JSON.stringify(slots)).not.toContain('Salary')
    for (const slot of slots) {
      expect(Object.keys(slot).sort()).toEqual(['endMs', 'startMs', 'state'])
    }
  })

  it('CoalescesOverlappingAndTouchingBlocks', () => {
    const slots = toFreeBusy([
      { startMs: T0 + 2 * H, endMs: T0 + 3 * H }, // out of order on purpose
      { startMs: T0, endMs: T0 + H },
      { startMs: T0 + H, endMs: T0 + 2 * H }, // touches the first → one span
      { startMs: T0 + 2 * H + 10, endMs: T0 + 2 * H + 20 }, // contained in [2h,3h)
    ])
    expect(slots).toEqual([{ startMs: T0, endMs: T0 + 3 * H, state: 'busy' }])
  })

  it('DropsEmptyAndInvertedBlocks', () => {
    expect(
      toFreeBusy([
        { startMs: T0, endMs: T0 }, // zero length
        { startMs: T0 + 2 * H, endMs: T0 + H }, // inverted
      ]),
    ).toEqual([])
  })

  it('EmptyInput_IsEmpty', () => {
    expect(toFreeBusy([])).toEqual([])
  })
})

describe('freeGaps', () => {
  const window = { startMs: T0, endMs: T0 + 8 * H }

  it('ReturnsTheOpeningsBetweenBusySpans', () => {
    const gaps = freeGaps(
      [
        { startMs: T0 + H, endMs: T0 + 2 * H, title: 'x' },
        { startMs: T0 + 4 * H, endMs: T0 + 5 * H, title: 'y' },
      ],
      window,
    )
    expect(gaps).toEqual([
      { startMs: T0, endMs: T0 + H },
      { startMs: T0 + 2 * H, endMs: T0 + 4 * H },
      { startMs: T0 + 5 * H, endMs: T0 + 8 * H },
    ])
  })

  it('ClipsBusyBlocksToTheWindow', () => {
    // A block starting before and ending after the window leaves no gap at all.
    const gaps = freeGaps([{ startMs: T0 - 3 * H, endMs: T0 + 10 * H, title: 'all day' }], window)
    expect(gaps).toEqual([])
  })

  it('FullyFreeWindow_IsOneGap', () => {
    expect(freeGaps([], window)).toEqual([{ startMs: T0, endMs: T0 + 8 * H }])
  })

  it('IgnoresBlocksOutsideTheWindow', () => {
    const gaps = freeGaps([{ startMs: T0 + 20 * H, endMs: T0 + 21 * H, title: 'tomorrow' }], window)
    expect(gaps).toEqual([{ startMs: T0, endMs: T0 + 8 * H }])
  })

  it('EmptyOrInvertedWindow_IsEmpty', () => {
    expect(freeGaps([], { startMs: T0, endMs: T0 })).toEqual([])
    expect(freeGaps([], { startMs: T0 + H, endMs: T0 })).toEqual([])
  })
})
