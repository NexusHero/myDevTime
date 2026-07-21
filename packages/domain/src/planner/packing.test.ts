import { describe, expect, it } from 'vitest'
import {
  MIN_SPLIT_FRAGMENT_MIN,
  packWeek,
  type PackInput,
  type PackItem,
  type PackResult,
} from './packing.js'

/**
 * Acceptance for the fill-week packing core (REQ-073, ADR-0072 D2). The invariants of the
 * issue contract are pinned explicitly and then property-tested over seeded random inputs:
 * placements only inside the given windows, a day's placed sum never over its capacity line
 * (fill-week does NOT stretch — stretching is the repair's informed deal, #339), priority
 * order with stable ties, deterministic byte-equal reruns, and splitting only at ≥30-min
 * fragments. An item is placed whole or reported in `unplaced` — a half-placed ticket would
 * be a lie on the canvas.
 */
const item = (id: string, estimateMin: number, priority = 1, title = id): PackItem => ({
  id,
  title,
  estimateMin,
  priority,
})

const day = (
  key: string,
  windows: readonly { startMin: number; endMin: number }[],
  capacityLineMin = 480,
): PackInput['days'][number] => ({ day: key, windows, capacityLineMin })

const WEEK = '2026-07-20'
const w = (startMin: number, endMin: number): { startMin: number; endMin: number } => ({
  startMin,
  endMin,
})

function pack(days: PackInput['days'], items: readonly PackItem[]): PackResult {
  return packWeek({ weekStartDay: WEEK, days, items })
}

describe('packWeek', () => {
  it('NoItems_PlacesNothingAndReportsNothing', () => {
    expect(pack([day('2026-07-20', [w(480, 1080)])], [])).toEqual({
      placements: [],
      unplaced: [],
    })
  })

  it('OneItemOneWindow_PlacesAtTheWindowStart', () => {
    expect(pack([day('2026-07-20', [w(480, 1080)])], [item('a', 60)])).toEqual({
      placements: [{ itemId: 'a', day: '2026-07-20', startMin: 480, lenMin: 60 }],
      unplaced: [],
    })
  })

  it('PriorityOrder_LowerNumberTakesTheEarlierSlot', () => {
    const result = pack(
      [day('2026-07-20', [w(480, 1080)])],
      [item('late', 60, 5), item('first', 60, 1)],
    )
    expect(result.placements).toEqual([
      { itemId: 'first', day: '2026-07-20', startMin: 480, lenMin: 60 },
      { itemId: 'late', day: '2026-07-20', startMin: 540, lenMin: 60 },
    ])
  })

  it('EqualPriority_TiesBreakByStableInputOrder', () => {
    const result = pack(
      [day('2026-07-20', [w(480, 1080)])],
      [item('one', 60, 2), item('two', 60, 2)],
    )
    expect(result.placements.map(p => p.itemId)).toEqual(['one', 'two'])
  })

  it('WindowsOnly_AMeetingGapIsNeverPlacedInto', () => {
    // Free 08:00–10:00 and 13:00–18:00 — the 10:00–13:00 meeting block is not a window.
    const result = pack(
      [day('2026-07-20', [w(480, 600), w(780, 1080)])],
      [item('a', 120), item('b', 120)],
    )
    expect(result.placements).toEqual([
      { itemId: 'a', day: '2026-07-20', startMin: 480, lenMin: 120 },
      { itemId: 'b', day: '2026-07-20', startMin: 780, lenMin: 120 },
    ])
  })

  it('CapacityLine_TheDaySumNeverExceedsIt_OverflowMovesToTheNextDay', () => {
    const result = pack(
      [day('2026-07-20', [w(480, 1080)], 90), day('2026-07-21', [w(480, 1080)], 480)],
      [item('a', 60), item('b', 60)],
    )
    // Day 1 has 90 min of line: `a` fits whole; `b` cannot split (30 rest would be fine but
    // 60−30=30 fragment fits) — the split IS taken: 30 on Monday, 30 on Tuesday.
    expect(result.placements).toEqual([
      { itemId: 'a', day: '2026-07-20', startMin: 480, lenMin: 60 },
      { itemId: 'b', day: '2026-07-20', startMin: 540, lenMin: 30 },
      { itemId: 'b', day: '2026-07-21', startMin: 480, lenMin: 30 },
    ])
    expect(result.unplaced).toEqual([])
  })

  it('NoStretch_AnItemOverEveryLineIsUnplacedWithNoPartialPlacement', () => {
    const result = pack([day('2026-07-20', [w(480, 1080)], 120)], [item('big', 240)])
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual(['big'])
  })

  it('AllOrNothing_ARolledBackItemFreesItsSpaceForLaterItems', () => {
    // `big` consumes the whole day tentatively but cannot finish anywhere → rolled back;
    // `small` then gets the untouched window start.
    const result = pack(
      [day('2026-07-20', [w(480, 600)], 480)],
      [item('big', 500, 1), item('small', 60, 2)],
    )
    expect(result.unplaced).toEqual(['big'])
    expect(result.placements).toEqual([
      { itemId: 'small', day: '2026-07-20', startMin: 480, lenMin: 60 },
    ])
  })

  it('SplitAcrossDays_EveryFragmentIsAtLeastTheFloor', () => {
    // 100 min against an 80-min Monday window: a naive 80/20 split breaks the floor; the
    // packing takes 70 (leaving a ≥30 rest) and finishes with 30 on Tuesday.
    const result = pack(
      [day('2026-07-20', [w(480, 560)]), day('2026-07-21', [w(480, 1080)])],
      [item('a', 100)],
    )
    expect(result.placements).toEqual([
      { itemId: 'a', day: '2026-07-20', startMin: 480, lenMin: 70 },
      { itemId: 'a', day: '2026-07-21', startMin: 480, lenMin: 30 },
    ])
    for (const p of result.placements) {
      expect(p.lenMin).toBeGreaterThanOrEqual(MIN_SPLIT_FRAGMENT_MIN)
    }
  })

  it('FragmentFloor_ASliverThatCannotHoldAFloorFragmentIsSkipped', () => {
    // 45-min item, only 20-min windows anywhere: no split can produce two ≥30 fragments and
    // no window holds it whole → honestly unplaced.
    const result = pack(
      [day('2026-07-20', [w(480, 500), w(600, 620)]), day('2026-07-21', [w(480, 500)])],
      [item('a', 45)],
    )
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual(['a'])
  })

  it('WholePlacementBelowTheFloor_IsAllowed_TheFloorGovernsSplitsOnly', () => {
    // A 20-min item placed in one piece is fine — the ≥30 floor is a *fragment* rule.
    const result = pack([day('2026-07-20', [w(480, 1080)])], [item('tiny', 20)])
    expect(result.placements).toEqual([
      { itemId: 'tiny', day: '2026-07-20', startMin: 480, lenMin: 20 },
    ])
  })

  it('NonPositiveEstimate_IsUnplacedNeverInvented', () => {
    const result = pack([day('2026-07-20', [w(480, 1080)])], [item('zero', 0), item('neg', -30)])
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual(['zero', 'neg'])
  })

  it('InvalidAndOverlappingWindows_AreNormalizedNotTrusted', () => {
    // An inverted window carries no time; two overlapping windows are one stretch of wall
    // clock, never double capacity.
    const result = pack(
      [day('2026-07-20', [w(600, 480), w(480, 540), w(510, 570)], 480)],
      [item('a', 90), item('b', 30)],
    )
    expect(result.placements).toEqual([
      { itemId: 'a', day: '2026-07-20', startMin: 480, lenMin: 90 },
    ])
    expect(result.unplaced).toEqual(['b'])
  })

  it('UnplacedKeepsTheConsideredOrder_HonestCountForTheNotice', () => {
    const result = pack(
      [day('2026-07-20', [w(480, 540)])],
      [item('fits', 60, 1), item('nope1', 300, 2), item('nope2', 300, 3)],
    )
    expect(result.unplaced).toEqual(['nope1', 'nope2'])
  })

  it('Deterministic_SameInputYieldsByteEqualOutput', () => {
    const input: PackInput = {
      weekStartDay: WEEK,
      days: [
        day('2026-07-20', [w(480, 600), w(780, 1080)], 300),
        day('2026-07-21', [w(480, 1080)]),
      ],
      items: [item('a', 90, 2), item('b', 240, 1), item('c', 45, 2)],
    }
    expect(JSON.stringify(packWeek(input))).toBe(JSON.stringify(packWeek(input)))
  })
})

// ── Property tests over seeded random weeks ────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) — the property runs are reproducible by seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomInput(rand: () => number): PackInput {
  const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))
  const dayCount = int(1, 7)
  const days = Array.from({ length: dayCount }, (_, d) => {
    // Disjoint, sorted windows inside a 06:00–20:00 frame.
    const windows: { startMin: number; endMin: number }[] = []
    let cursor = 360
    const windowCount = int(0, 4)
    for (let i = 0; i < windowCount && cursor < 1200 - 15; i++) {
      const start = cursor + int(0, 60)
      const end = Math.min(1200, start + int(15, 240))
      if (end > start) windows.push({ startMin: start, endMin: end })
      cursor = end + int(5, 45)
    }
    return {
      day: `2026-07-${String(20 + d).padStart(2, '0')}`,
      windows,
      capacityLineMin: int(0, 600),
    }
  })
  const items = Array.from({ length: int(0, 10) }, (_, i) => ({
    id: `item-${String(i)}`,
    title: `Item ${String(i)}`,
    estimateMin: int(1, 600),
    priority: int(0, 5),
  }))
  return { weekStartDay: days[0]?.day ?? WEEK, days, items }
}

const RUNS = 300

describe('packWeek · properties', () => {
  it('Property_PlacementsAlwaysLieInsideAGivenWindowOfTheirDay', () => {
    const rand = mulberry32(1)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      const { placements } = packWeek(input)
      for (const p of placements) {
        const dayRow = input.days.find(d => d.day === p.day)
        expect(dayRow).toBeDefined()
        const inside = (dayRow?.windows ?? []).some(
          win => p.startMin >= win.startMin && p.startMin + p.lenMin <= win.endMin,
        )
        expect(inside, `run ${String(run)}: ${JSON.stringify(p)} escapes the windows`).toBe(true)
      }
    }
  })

  it('Property_ADaysPlacedSumNeverExceedsItsCapacityLine_AndNothingOverlaps', () => {
    const rand = mulberry32(2)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      const { placements } = packWeek(input)
      for (const dayRow of input.days) {
        const onDay = placements
          .filter(p => p.day === dayRow.day)
          .sort((a, b) => a.startMin - b.startMin)
        const sum = onDay.reduce((acc, p) => acc + p.lenMin, 0)
        expect(sum, `run ${String(run)}: over the line on ${dayRow.day}`).toBeLessThanOrEqual(
          dayRow.capacityLineMin,
        )
        for (let i = 1; i < onDay.length; i++) {
          const prev = onDay[i - 1]
          const next = onDay[i]
          if (prev && next) {
            expect(prev.startMin + prev.lenMin, `run ${String(run)}: overlap`).toBeLessThanOrEqual(
              next.startMin,
            )
          }
        }
      }
    }
  })

  it('Property_EveryItemIsEitherPlacedExactlyWholeOrHonestlyUnplaced', () => {
    const rand = mulberry32(3)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      const { placements, unplaced } = packWeek(input)
      const unplacedSet = new Set(unplaced)
      for (const it of input.items) {
        const placedMin = placements
          .filter(p => p.itemId === it.id)
          .reduce((acc, p) => acc + p.lenMin, 0)
        if (unplacedSet.has(it.id)) {
          expect(placedMin, `run ${String(run)}: unplaced ${it.id} left fragments`).toBe(0)
        } else {
          expect(placedMin, `run ${String(run)}: ${it.id} not whole`).toBe(it.estimateMin)
        }
      }
      // Nothing outside the input is ever placed or reported.
      const ids = new Set(input.items.map(x => x.id))
      for (const p of placements) expect(ids.has(p.itemId)).toBe(true)
      for (const u of unplaced) expect(ids.has(u)).toBe(true)
    }
  })

  it('Property_SplitFragmentsNeverFallBelowTheFloor', () => {
    const rand = mulberry32(4)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      const { placements } = packWeek(input)
      const byItem = new Map<string, number[]>()
      for (const p of placements) {
        byItem.set(p.itemId, [...(byItem.get(p.itemId) ?? []), p.lenMin])
      }
      for (const [id, lens] of byItem) {
        if (lens.length > 1) {
          for (const len of lens) {
            expect(len, `run ${String(run)}: ${id} fragment under floor`).toBeGreaterThanOrEqual(
              MIN_SPLIT_FRAGMENT_MIN,
            )
          }
        }
      }
    }
  })

  it('Property_SameInputTwice_IsByteEqual', () => {
    const rand = mulberry32(5)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      expect(JSON.stringify(packWeek(input))).toBe(JSON.stringify(packWeek(input)))
    }
  })

  it('Property_PriorityPrefixStability_ALowerPriorityItemNeverStealsFromAHigherOne', () => {
    // Packing only the first k items of the priority order yields exactly the placements
    // the full pack gave those k items — later (lower-priority) items never influence them.
    const rand = mulberry32(6)
    for (let run = 0; run < RUNS; run++) {
      const input = randomInput(rand)
      const full = packWeek(input)
      const ordered = input.items
        .map((it, index) => ({ it, index }))
        .sort((a, b) => a.it.priority - b.it.priority || a.index - b.index)
        .map(x => x.it)
      for (const k of [0, Math.floor(ordered.length / 2), ordered.length]) {
        const prefix = new Set(ordered.slice(0, k).map(x => x.id))
        const partial = packWeek({
          ...input,
          items: input.items.filter(x => prefix.has(x.id)),
        })
        expect(partial.placements).toEqual(full.placements.filter(p => prefix.has(p.itemId)))
        expect(partial.unplaced).toEqual(full.unplaced.filter(id => prefix.has(id)))
      }
    }
  })
})
