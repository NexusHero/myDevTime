// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable, TextInput } from 'react-native'
import { CommandBarPanel } from './CommandBar.js'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import type { Command } from './commands.js'

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const COMMANDS: Command[] = [
  { id: 'timer-start', group: 'Timer', label: 'Start timer', action: { type: 'timer-start' } },
  {
    id: 'start:p1',
    group: 'Start on…',
    label: 'Finanzo AG',
    action: { type: 'start-project', projectId: 'p1', name: 'Finanzo AG' },
  },
  {
    id: 'go:reports',
    group: 'Go to',
    label: 'Reports',
    action: { type: 'navigate', screen: 'reports' },
  },
]

describe('CommandBarPanel', () => {
  it('ListsEveryCommandLabel', () => {
    const r = render(<CommandBarPanel onClose={() => {}} commands={COMMANDS} onRun={() => {}} />)
    const json = JSON.stringify(r.toJSON())
    expect(json).toContain('Start timer')
    expect(json).toContain('Finanzo AG')
    expect(json).toContain('Reports')
  })

  it('TappingARow_DispatchesItsTypedAction_AndCloses', () => {
    const onRun = vi.fn()
    const onClose = vi.fn()
    const r = render(<CommandBarPanel onClose={onClose} commands={COMMANDS} onRun={onRun} />)
    const rows = r.root.findAllByType(Pressable)
    for (const row of rows) {
      act(() => {
        ;(row.props.onPress as (() => void) | undefined)?.()
      })
    }
    expect(onRun).toHaveBeenCalledWith({ type: 'navigate', screen: 'reports' })
    expect(onRun).toHaveBeenCalledWith({
      type: 'start-project',
      projectId: 'p1',
      name: 'Finanzo AG',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('TypingAQuery_FiltersTheList', () => {
    const r = render(<CommandBarPanel onClose={() => {}} commands={COMMANDS} onRun={() => {}} />)
    const input = r.root.findByType(TextInput)
    act(() => {
      ;(input.props.onChangeText as (v: string) => void)('finanzo')
    })
    const json = JSON.stringify(r.toJSON())
    expect(json).toContain('Finanzo AG')
    expect(json).not.toContain('Start timer')
  })
})
