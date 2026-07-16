import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Island } from './Island.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * The Island's brand glyph (ADR-0061): the floating phone pill leads with the living
 * LiveMark (its S-signature identifies it), while the docked desktop pill keeps the
 * plain live dot — the sidebar header already carries the mark there, so the mark is
 * never doubled in one region.
 */
function render(node: React.ReactNode): string {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return JSON.stringify(r.toJSON())
}

describe('Island brand glyph', () => {
  it('Island_floating_leadsWithTheLiveMark', () => {
    const json = render(<Island posture="floating" running elapsed="00:12:00" />)
    expect(json).toContain('M148 92') // the LiveMark S-signature
  })

  it('Island_docked_keepsThePlainLiveDot_noMark', () => {
    const json = render(<Island posture="docked" running elapsed="00:12:00" />)
    expect(json).not.toContain('M148 92') // no mark on the desktop dock
  })
})
