import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { BrandSplash } from './BrandSplash.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * The launch sting (BrandSplash, ADR-0061). Under the render-test env the reanimated
 * shim reports reduced-motion ON, so it collapses to a brief static hold: it paints
 * the mark + wordmark and then calls `onDone` (so the overlay unmounts and never
 * blocks the app), rather than running the full ~1.8s choreography.
 */
describe('BrandSplash', () => {
  it('BrandSplash_reducedMotion_paintsTheMarkThenCallsOnDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <BrandSplash onDone={onDone} />
        </ThemeProvider>,
      )
    })

    // The wordmark + the mark's S-signature paint immediately.
    const json = JSON.stringify(r.toJSON())
    expect(json).toContain('myDevTime')
    expect(json).toContain('M148 92')

    // It hands over rather than blocking: onDone fires after the reduced hold.
    act(() => {
      vi.runAllTimers()
    })
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
