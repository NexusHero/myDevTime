import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PauseCounter } from './PauseCounter.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * PauseCounter renders the live "Pause MM:SS" line that stacks under the frozen worked
 * time. It ticks once a second from `pausedSinceMs`, so the tests drive fake timers and
 * assert the label advances; a null `pausedSinceMs` (not paused) must render nothing.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const text = (r: TestRenderer.ReactTestRenderer): string => JSON.stringify(r.toJSON())

describe('PauseCounter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T09:03:20.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('NotPaused_RendersNothing', () => {
    const r = render(<PauseCounter pausedSinceMs={null} />)
    expect(r.toJSON()).toBeNull()
  })

  it('Paused_ShowsMinutesSecondsFromPausedSince', () => {
    // Paused 200 s (03:20) ago.
    const since = Date.parse('2026-07-10T09:00:00.000Z')
    const r = render(<PauseCounter pausedSinceMs={since} />)
    expect(text(r)).toContain('Pause 03:20')
  })

  it('Paused_TicksUpEachSecond', () => {
    const since = Date.parse('2026-07-10T09:00:00.000Z')
    const r = render(<PauseCounter pausedSinceMs={since} />)
    expect(text(r)).toContain('Pause 03:20')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(text(r)).toContain('Pause 03:21')
  })
})
