// @vitest-environment jsdom
// The conversation mounts a react-native-web TextInput, which touches `document`.
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssistantOverlay } from './AssistantOverlay.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the Assistant overlay (ADR-0063, backlog H3): it is
 * absent when closed, shows the grounded chat when open, and the ✕ closes it.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>,
    )
  })
  return r
}

/** Every rendered string, flattened — lets a test assert copy is present. */
function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

describe('AssistantOverlay', () => {
  it('AssistantOverlay_closed_rendersNothing', () => {
    const r = render(<AssistantOverlay open={false} onClose={() => {}} />)
    expect(r.toJSON()).toBeNull()
  })

  it('AssistantOverlay_open_showsTheGroundedChat', () => {
    const r = render(<AssistantOverlay open onClose={() => {}} />)
    const all = texts(r)
    expect(all).toContain('Assistant')
    expect(all).toContain('Your data · read-only')
    // The read-only, deterministic promise is the product's AI-provenance contract.
    expect(all).toContain('Ask your own data')
  })

  it('AssistantOverlay_pressingClose_callsOnClose', () => {
    const onClose = vi.fn()
    const r = render(<AssistantOverlay open onClose={onClose} />)
    const closer = r.root
      .findAllByType(Pressable)
      .find(p => p.props.accessibilityLabel === 'Close assistant')
    expect(closer).toBeDefined()
    act(() => {
      closer!.props.onPress()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
