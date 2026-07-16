import { describe, expect, it } from 'vitest'
import type { ActivitySample } from '@mydevtime/domain'
import {
  diffUsage,
  nativeUsageCapture,
  type NativeUsageModule,
  type NativeUsageReading,
} from './nativeUsage.js'

describe('diffUsage', () => {
  it('FirstReading_OnlySetsTheBaseline', () => {
    const { samples, baseline } = diffUsage(new Map(), [{ source: 'VS Code', totalMs: 5000 }])
    expect(samples).toEqual([])
    expect(baseline.get('VS Code')).toBe(5000)
  })

  it('EmitsThePositiveDeltaPerSource', () => {
    const prev = new Map([
      ['VS Code', 5000],
      ['Chrome', 2000],
    ])
    const { samples } = diffUsage(prev, [
      { source: 'VS Code', totalMs: 9000 }, // +4000
      { source: 'Chrome', totalMs: 2000 }, // unchanged → no span
      { source: 'Slack', totalMs: 1000 }, // new → baseline only
    ])
    expect(samples).toEqual([{ source: 'VS Code', ms: 4000 }])
  })

  it('CounterReset_RebaselinesWithoutANegativeSpan', () => {
    const prev = new Map([['VS Code', 9000]])
    const { samples, baseline } = diffUsage(prev, [{ source: 'VS Code', totalMs: 100 }])
    expect(samples).toEqual([])
    expect(baseline.get('VS Code')).toBe(100)
  })
})

describe('nativeUsageCapture', () => {
  it('PollsAndFeedsBetweenPollDeltas_UntilStopped', async () => {
    const scripted: NativeUsageReading[][] = [
      [{ source: 'VS Code', totalMs: 1000 }], // baseline
      [{ source: 'VS Code', totalMs: 4000 }], // +3000
      [{ source: 'VS Code', totalMs: 5000 }], // +1000
    ]
    let call = 0
    const module: NativeUsageModule = {
      hasPermission: () => Promise.resolve(true),
      requestPermission: () => Promise.resolve(),
      query: () => Promise.resolve(scripted[Math.min(call++, scripted.length - 1)] ?? []),
    }
    const timer: { fn: (() => void) | null } = { fn: null }
    const capture = nativeUsageCapture(module, {
      pollMs: 1000,
      setInterval: fn => {
        timer.fn = fn
        return 0 as unknown as ReturnType<typeof setInterval>
      },
      clearInterval: () => undefined,
    })

    const seen: ActivitySample[] = []
    const stop = capture.start(s => seen.push(s))
    await Promise.resolve() // let the immediate baseline poll resolve
    timer.fn?.() // second poll → +3000
    await Promise.resolve()
    timer.fn?.() // third poll → +1000
    await Promise.resolve()
    stop()
    timer.fn?.() // ignored after stop
    await Promise.resolve()

    expect(seen).toEqual([
      { source: 'VS Code', ms: 3000 },
      { source: 'VS Code', ms: 1000 },
    ])
  })
})
