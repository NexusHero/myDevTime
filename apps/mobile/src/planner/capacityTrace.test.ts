import { describe, expect, it } from 'vitest'
import { weekCapacityFromBlocks, type CapacityBlock } from './capacityTrace.js'

const HOUR = 60 * 60_000

/**
 * The Planner capacity head-trace glue (REQ-055, design v14 §F). It shapes the canvas blocks
 * into the deterministic `weekCapacity` core so the header shows the true plannable capacity —
 * target minus the person's own life/protected commitments. The figures are the core's.
 */
describe('weekCapacityFromBlocks', () => {
  it('IsTheFullTargetWhenNoLifeOrProtectedBlocksExist', () => {
    const blocks: CapacityBlock[] = [
      { day: 0, start: 0, len: 120, kind: 'actual' }, // work, does not reduce capacity
      { day: 1, start: 60, len: 90, kind: 'meeting' },
    ]
    const cap = weekCapacityFromBlocks(blocks, { availableDays: 5, targetDailyMin: 480 })
    expect(cap.committedMs).toBe(0)
    expect(cap.plannableMs).toBe(cap.targetMs)
    expect(cap.targetMs).toBe(5 * 8 * HOUR)
  })

  it('SubtractsLifeBlocksFromThePlannableCapacity', () => {
    const blocks: CapacityBlock[] = [
      { day: 0, start: 0, len: 120, kind: 'life' }, // 2h life on Monday
    ]
    const cap = weekCapacityFromBlocks(blocks, { availableDays: 5, targetDailyMin: 480 })
    expect(cap.committedMs).toBe(2 * HOUR)
    expect(cap.plannableMs).toBe(cap.targetMs - 2 * HOUR)
  })

  it('CountsAProtectedBlockAsACommitment', () => {
    const blocks: CapacityBlock[] = [
      { day: 2, start: 120, len: 60, kind: 'actual', protectedFlag: true },
    ]
    const cap = weekCapacityFromBlocks(blocks)
    expect(cap.committedMs).toBe(1 * HOUR)
  })

  it('IgnoresBlocksOnDaysBeyondTheAvailableWindow', () => {
    const blocks: CapacityBlock[] = [{ day: 6, start: 0, len: 120, kind: 'life' }] // weekend
    const cap = weekCapacityFromBlocks(blocks, { availableDays: 5 })
    expect(cap.committedMs).toBe(0)
  })

  it('ClampsALifeBlockRunningPastMidnightIntoTheDay', () => {
    // 23:00 start (900 min from 08:00) for 3h would spill past midnight → clamped to 1h.
    const blocks: CapacityBlock[] = [{ day: 0, start: 900, len: 180, kind: 'life' }]
    const cap = weekCapacityFromBlocks(blocks)
    expect(cap.committedMs).toBe(1 * HOUR) // 23:00–24:00 only
  })

  it('IsAnEmptyWeekWhenThereAreNoWorkingDays', () => {
    const cap = weekCapacityFromBlocks([{ day: 0, start: 0, len: 60, kind: 'life' }], {
      availableDays: 0,
    })
    expect(cap.targetMs).toBe(0)
    expect(cap.plannableMs).toBe(0)
    expect(cap.days).toEqual([])
  })
})
