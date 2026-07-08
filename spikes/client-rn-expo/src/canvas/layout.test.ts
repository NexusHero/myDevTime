import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GEOM,
  moveBlock,
  overlaps,
  resizeBlock,
  snap,
  splitBlock,
  yToMin,
  type Block,
} from './layout.js'

const g = DEFAULT_GEOM // 1 px/min, 5-min snap, 00:00–24:00, min 5 min
const block = (startMin: number, endMin: number, id = 'a'): Block => ({ id, startMin, endMin })

describe('Day Canvas geometry (worklet-pure)', () => {
  it('Snap_RoundsToGrid', () => {
    expect(snap(63, g)).toBe(65)
    expect(snap(62, g)).toBe(60)
  })

  it('Move_SnapsAndKeepsDurationAndBounds', () => {
    const b = moveBlock(block(540, 600), 63, g) // 09:00–10:00 dragged +63px(min)
    expect(b.endMin - b.startMin).toBe(60) // duration preserved
    expect(b.startMin).toBe(605) // 540+63=603 → snap 605
    // dragged past end of day keeps the tail in-bounds
    const tail = moveBlock(block(1380, 1440), 120, g)
    expect(tail.endMin).toBe(1440)
    expect(tail.startMin).toBe(1380)
  })

  it('Resize_RespectsMinDurationAndBounds', () => {
    const grown = resizeBlock(block(540, 600), 'end', 30, g)
    expect(grown.endMin).toBe(630)
    // shrinking the end past the min is clamped to start+min
    const clamped = resizeBlock(block(540, 600), 'end', -100, g)
    expect(clamped.endMin).toBe(545) // 540 + minBlockMin(5)
    // moving the start handle down cannot cross the end
    const startPulled = resizeBlock(block(540, 600), 'start', 200, g)
    expect(startPulled.startMin).toBe(595) // 600 - min(5)
  })

  it('Split_ConservesTotalDurationExactly', () => {
    const parts = splitBlock(block(540, 660), yToMin(600, g), g) // cut at 10:00
    expect(parts).toHaveLength(2)
    const total = parts.reduce((s, p) => s + (p.endMin - p.startMin), 0)
    expect(total).toBe(120) // 60 + 60, no time lost or created
    expect(parts[0]!.endMin).toBe(parts[1]!.startMin) // contiguous
  })

  it('Split_RefusedWhenAHalfWouldBeTooSmall', () => {
    const parts = splitBlock(block(540, 548), yToMin(546, g), g) // 8-min block, min 5
    expect(parts).toEqual([block(540, 548)]) // unchanged singleton
  })

  it('Overlaps_DetectsCollision', () => {
    expect(overlaps(block(540, 600), block(590, 620))).toBe(true)
    expect(overlaps(block(540, 600), block(600, 620))).toBe(false) // touching, not overlapping
  })
})
