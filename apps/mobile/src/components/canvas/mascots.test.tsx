import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Sevi } from './Sevi.js'
import { Blocky } from './Blocky.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * The edge mascots (Sevi, Blocky — ADR-0061). They render as static token-coloured
 * SVG figures across every mood/variant, so they are reduced-motion-safe by
 * construction and paint in the current theme.
 */
function render(node: React.ReactNode): string {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return JSON.stringify(r.toJSON())
}

describe('Sevi', () => {
  it.each(['focus', 'pause', 'celebrate'] as const)('Sevi_%s_rendersTheOrangeBody', mood => {
    const json = render(<Sevi mood={mood} />)
    // The body is the live-orange dot (theme live colour, default Sovereign light).
    expect(json).toContain('#ff5320')
  })
})

describe('Blocky', () => {
  it('Blocky_solid_rendersAFilledAccentBlock', () => {
    const json = render(<Blocky variant="solid" />)
    // Solid = tracked reality: the accent-filled block + the white face.
    expect(json).toContain('#ffffff')
  })

  it('Blocky_ghost_rendersADashedOutline', () => {
    const json = render(<Blocky variant="ghost" />)
    // Ghost = the plan: a dashed outline (same provenance rule as the Day Canvas).
    expect(json).toContain('13 11')
  })
})
