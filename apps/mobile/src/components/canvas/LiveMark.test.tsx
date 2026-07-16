import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { LiveMark } from './LiveMark.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * The living logo mark (LiveMark, ADR-0061). Under the render-test env the
 * reanimated shim reports reduced-motion ON, so the mark renders at rest in every
 * state — proving the static "Now-Split" geometry (actual block · S-signature ·
 * ghost block + Now-dot) paints and that opting out of motion is a plain mark.
 */
function render(node: React.ReactNode): string {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return JSON.stringify(r.toJSON())
}

describe('LiveMark', () => {
  it('LiveMark_idle_rendersTheNowSplitGeometry', () => {
    const json = render(<LiveMark />)
    // The S-signature path is the mark's identity — present in every state.
    expect(json).toContain('M148 92')
    // The live-orange Now-dot is painted (theme live color).
    expect(json).toContain('#ff5320')
  })

  it('LiveMark_tracking_reducedMotion_isStaticNoRing', () => {
    // Reduced-motion ON → no animated tracking ring, just the static mark.
    const json = render(<LiveMark state="tracking" size={64} />)
    expect(json).toContain('M148 92')
  })

  it('LiveMark_celebrate_stillRendersTheMark', () => {
    const json = render(<LiveMark state="celebrate" />)
    expect(json).toContain('M148 92')
  })
})
