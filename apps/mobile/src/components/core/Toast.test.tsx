import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { ToastProvider, useToast } from './Toast.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the v20 toast: it shows nothing until asked, surfaces a message on
 * `show`, and a newer message replaces the current one (single transient pill).
 */
function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

/** A tiny consumer that exposes `show` through a pressable, so tests can fire toasts. */
function Harness({ onReady }: { onReady: (show: (m: string) => void) => void }): null {
  const { show } = useToast()
  onReady(show)
  return null
}

function mount(): { r: TestRenderer.ReactTestRenderer; show: (m: string) => void } {
  let show!: (m: string) => void
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <Harness onReady={s => (show = s)} />
        </ToastProvider>
      </ThemeProvider>,
    )
  })
  return { r, show }
}

describe('Toast', () => {
  it('ShowsNothingUntilAsked', () => {
    const { r } = mount()
    expect(texts(r)).toBe('')
  })

  it('SurfacesAMessageOnShow', () => {
    const { r, show } = mount()
    act(() => {
      show('Timer running on Finanzo API')
    })
    expect(texts(r)).toContain('Timer running on Finanzo API')
  })

  it('NewerMessageReplacesTheCurrentOne', () => {
    const { r, show } = mount()
    act(() => {
      show('First')
    })
    act(() => {
      show('Second')
    })
    const out = texts(r)
    expect(out).toContain('Second')
    expect(out).not.toContain('First')
  })

  it('IgnoresBlankMessages', () => {
    const { r, show } = mount()
    act(() => {
      show('   ')
    })
    expect(texts(r)).toBe('')
  })
})
