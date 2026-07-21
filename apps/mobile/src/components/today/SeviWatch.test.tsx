// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the SeviWatch line — Sevi's calm, non-modal inline
 * voice on Today (ADR-0071, REQ-067/069). Pinned: a delivered nudge renders as a
 * `role="status"` region whose accessible name IS the reason line (so assistive
 * tech and the e2e specs read the same thing), a silent watch renders nothing at
 * all, and the surface is static — no animation, so reduced-motion needs nothing
 * to switch off (ux-vision motion language: calm by default).
 */
const seams = vi.hoisted(() => ({
  resource: {
    visible: false,
    message: null as string | null,
    digestPending: false,
  },
}))

vi.mock('../../hooks/useSeviWatch.js', () => ({
  useSeviWatch: () => seams.resource,
}))

const { SeviWatch } = await import('./SeviWatch.js')

function render(): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <SeviWatch />
      </ThemeProvider>,
    )
  })
  return r
}

describe('SeviWatch', () => {
  it('SpeakUpDelivered_RendersStatusRegion_WithTheReasonAsAccessibleName', () => {
    seams.resource = {
      visible: true,
      message: 'A long day — wrapping up soon?',
      digestPending: false,
    }
    const r = render()
    const region = r.root.findAll(n => typeof n.type === 'string' && n.props.role === 'status')
    expect(region).toHaveLength(1)
    // react-native-web maps `accessibilityLabel` to the host's `aria-label` — the
    // accessible name Playwright's getByRole('status', { name }) resolves.
    expect(region[0]!.props['aria-label']).toBe('A long day — wrapping up soon?')
    // The reason line is also visible text, not only an ARIA name.
    expect(JSON.stringify(r.toJSON())).toContain('A long day — wrapping up soon?')
  })

  it('Calm_RendersNothingAtAll', () => {
    seams.resource = { visible: false, message: null, digestPending: false }
    const r = render()
    expect(r.toJSON()).toBeNull()
  })

  it('Static_NoAnimationProps_SoReducedMotionNeedsNoSwitch', () => {
    seams.resource = {
      visible: true,
      message: 'A long day — wrapping up soon?',
      digestPending: false,
    }
    const r = render()
    // A calm, static surface: nothing in the rendered tree is an Animated/Reanimated
    // host (their test-rendered type names carry "Animated"), and re-rendering the
    // same state yields the same tree — no time-driven output.
    const first = JSON.stringify(r.toJSON())
    expect(first).not.toMatch(/Animated/i)
    act(() => {
      r.update(
        <ThemeProvider>
          <SeviWatch />
        </ThemeProvider>,
      )
    })
    expect(JSON.stringify(r.toJSON())).toBe(first)
  })
})
