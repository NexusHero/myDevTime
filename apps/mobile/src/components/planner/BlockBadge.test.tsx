// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { BlockBadge } from './BlockBadge.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for a canvas block's marker (issue #381). The markers used to be typed
 * codes — `↻`, `⇄ OL` — which is why a `<Legend />` had to exist to explain them. A legend is a UI
 * admitting it failed. The marker is now a glyph plus a spelled-out meaning that a screen reader
 * reads, so the picture and the words carry the same information (REQ-043).
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function labels(r: TestRenderer.ReactTestRenderer): string[] {
  return r.root
    .findAll(n => typeof n.props.accessibilityLabel === 'string')
    .map(n => n.props.accessibilityLabel as string)
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

describe('BlockBadge', () => {
  it('SpellsItsMeaningForAScreenReader', () => {
    // The whole point: an icon carries no words, so the meaning must be stated.
    const r = render(<BlockBadge icon="repeat" meaning="Recurring" color="#1fa894" />)
    expect(labels(r)).toContain('Recurring')
  })

  it('ShowsNoTypedCodeWhenItHasAnIcon', () => {
    // `↻` and `⇄ OL` were codes you had to learn. The glyph replaces them.
    const out = texts(render(<BlockBadge icon="repeat" meaning="Recurring" color="#1fa894" />))
    expect(out).not.toContain('↻')
    expect(out).not.toContain('⇄')
  })

  it('FallsBackToItsTextWhenThereIsNoIconForIt', () => {
    // `FYI` is a word people read, not a code — it stays text, and stays labelled.
    const r = render(<BlockBadge text="FYI" meaning="For information only" color="#7c8698" />)
    expect(texts(r)).toContain('FYI')
    expect(labels(r)).toContain('For information only')
  })

  it('CarriesTheGivenColourSoItSitsOnAnyFill', () => {
    // A block's fill is the project colour, so the marker's ink is passed in, never assumed.
    const r = render(<BlockBadge icon="repeat" meaning="Recurring" color="#ff0000" />)
    const tinted = r.root.findAll(
      n => typeof n.props.style === 'object' && n.props.style?.borderColor === '#ff0000',
    )
    expect(tinted.length).toBeGreaterThan(0)
  })
})
