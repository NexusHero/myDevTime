// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import type { RecurrenceRule } from '@mydevtime/domain'
import { RecurrenceEditor } from './RecurrenceEditor.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the ↻ recurrence editor (REQ-060, design v17 §F4): the frequency
 * and end controls emit a `RecurrenceRule`, and the label under them is the domain's
 * `describeRecurrence`, so the wording tracks the core.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

function pressByLabel(r: TestRenderer.ReactTestRenderer, label: string): void {
  const p = r.root.findAllByType(Pressable).find(x => x.props.accessibilityLabel === label)
  expect(p, `pressable "${label}"`).toBeDefined()
  act(() => {
    p!.props.onPress()
  })
}

const NONE: RecurrenceRule = { freq: 'none', end: { kind: 'never' } }

describe('RecurrenceEditor', () => {
  it('Once_showsNoEndControl_andDescribesAsDoesNotRepeat', () => {
    const r = render(<RecurrenceEditor value={NONE} onChange={() => {}} />)
    expect(texts(r)).toContain('Does not repeat')
    // The end options only appear once it repeats.
    const labels = r.root.findAllByType(Pressable).map(p => p.props.accessibilityLabel)
    expect(labels).not.toContain('Never')
  })

  it('ChoosingWeekly_emitsAWeeklyRule', () => {
    const onChange = vi.fn()
    const r = render(<RecurrenceEditor value={NONE} onChange={onChange} />)
    pressByLabel(r, 'Weekly')
    expect(onChange).toHaveBeenCalledWith({ freq: 'weekly', end: { kind: 'never' } })
  })

  it('Repeating_showsTheEndControl_andDescribesTheRule', () => {
    const weekly: RecurrenceRule = { freq: 'weekly', end: { kind: 'count', count: 6 } }
    const r = render(<RecurrenceEditor value={weekly} onChange={() => {}} />)
    expect(texts(r)).toContain('Weekly, 6 times')
    const labels = r.root.findAllByType(Pressable).map(p => p.props.accessibilityLabel)
    expect(labels).toContain('Count')
  })

  it('SwitchingEndToCount_emitsACountRule', () => {
    const onChange = vi.fn()
    const weekly: RecurrenceRule = { freq: 'weekly', end: { kind: 'never' } }
    const r = render(<RecurrenceEditor value={weekly} onChange={onChange} />)
    pressByLabel(r, 'Count')
    expect(onChange).toHaveBeenCalledWith({ freq: 'weekly', end: { kind: 'count', count: 1 } })
  })
})
