// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'
import { Button, Input } from '../components/index.js'

/**
 * Regression for the audit finding M-2: a failed rate save must be surfaced, not
 * swallowed. useRates is mocked so `create` rejects (as a live 4xx/5xx would); the
 * screen must render the error instead of silently clearing the form.
 */
vi.mock('../hooks/useRates', () => ({
  useRates: () => ({
    data: [],
    loading: false,
    error: null,
    reload: () => undefined,
    live: true,
    create: () => Promise.reject(new Error('Server sagt nein')),
    remove: () => Promise.resolve(),
  }),
}))

import { RatesScreen } from './RatesScreen.js'

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer
  await act(async () => {
    renderer = TestRenderer.create(
      <TestQueryProvider>
        <ThemeProvider>
          <RatesScreen onBack={() => undefined} />
        </ThemeProvider>
      </TestQueryProvider>,
    )
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return renderer
}

describe('RatesScreen — save error handling', () => {
  it('ShowsAnError_WhenSavingFails_InsteadOfSilentlyClearing', async () => {
    const renderer = await render()
    // Workspace level (default) needs no scope; a valid amount enables Save.
    act(() => {
      renderer.root.findAllByType(Input)[0]!.props.onChangeText('90')
    })
    await act(async () => {
      const save = renderer.root.findAllByType(Button).find(b => b.props.children === 'Save rate')
      save!.props.onPress()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(JSON.stringify(renderer.toJSON())).toContain('Server sagt nein')
  })
})
