// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { ShutdownCard, type ShutdownCardProps } from './ShutdownCard.js'
import type { TodayShutdown } from '../../today/shutdown.js'

/**
 * ShutdownCard is the extracted Feierabend ritual (issue #362), lifted verbatim from
 * [`TodayScreen`](../../screens/TodayScreen.tsx). It is a controlled view over the pure
 * [`todayShutdown`](../../today/shutdown.ts) view-model: it renders nothing when the day
 * is idle (nothing tracked or booked) or already closed, and shows the Booked / Tracked
 * reality / Still open figures + the `git commit -m "Feierabend"` button otherwise. The
 * deterministic core owns every figure (ADR-0005); this only renders its output.
 */
function makeShutdown(overrides: Partial<TodayShutdown['summary']> = {}): TodayShutdown {
  return {
    summary: {
      bookedMs: 2 * 3_600_000,
      trackedMs: 3 * 3_600_000,
      unbookedMs: 3_600_000,
      openDraftCount: 1,
      tomorrowFirst: 'Standup',
      clean: false,
      ...overrides,
    },
    drafts: [],
    recoveredMs: 3_600_000,
    state: 'review',
  }
}

function makeProps(overrides: Partial<ShutdownCardProps> = {}): ShutdownCardProps {
  return {
    shutdown: makeShutdown(),
    closed: false,
    onClose: vi.fn(),
    ...overrides,
  }
}

function render(props: ShutdownCardProps): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ShutdownCard {...props} />
      </ThemeProvider>,
    )
  })
  return r
}

const text = (r: TestRenderer.ReactTestRenderer): string => JSON.stringify(r.toJSON())

describe('ShutdownCard', () => {
  it('IdleState_RendersNothing', () => {
    const r = render(makeProps({ shutdown: { ...makeShutdown(), state: 'idle' } }))
    expect(r.toJSON()).toBeNull()
  })

  it('AlreadyClosed_RendersNothing', () => {
    const r = render(makeProps({ closed: true }))
    expect(r.toJSON()).toBeNull()
  })

  it('ReviewState_ShowsBookedTrackedAndStillOpen', () => {
    const r = render(makeProps())
    const tree = text(r)
    expect(tree).toContain('Booked')
    expect(tree).toContain('Tracked reality')
    expect(tree).toContain('Still open')
    // The figures come straight from the pure summary (formatDuration → "H:MM h").
    expect(tree).toContain('2:00 h')
    expect(tree).toContain('3:00 h')
    expect(tree).toContain('1:00 h')
  })

  it('CleanState_ShowsFeierabendMessageAndNoStillOpen', () => {
    const r = render(
      makeProps({
        shutdown: {
          ...makeShutdown({ unbookedMs: 0, openDraftCount: 0, clean: true }),
          state: 'clean',
        },
      }),
    )
    const tree = text(r)
    expect(tree).toContain('Feierabend')
    expect(tree).not.toContain('Still open')
  })

  it('TomorrowFirst_RendersTomorrowLine', () => {
    const r = render(makeProps())
    expect(text(r)).toContain('Tomorrow starts with Standup.')
  })

  it('NoTomorrowFirst_HidesTomorrowLine', () => {
    const r = render(
      makeProps({
        shutdown: makeShutdown({ tomorrowFirst: null }),
      }),
    )
    expect(text(r)).not.toContain('Tomorrow starts with')
  })

  it('GitCommitButton_FiresOnClose', () => {
    const onClose = vi.fn()
    const r = render(makeProps({ onClose }))
    const button = r.root.findByProps({ children: 'git commit -m "Feierabend"' })
    act(() => {
      ;(button.props.onPress as () => void)()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('UnbookedZero_HidesStillOpen', () => {
    const r = render(
      makeProps({
        shutdown: makeShutdown({ unbookedMs: 0 }),
      }),
    )
    expect(text(r)).not.toContain('Still open')
  })
})
