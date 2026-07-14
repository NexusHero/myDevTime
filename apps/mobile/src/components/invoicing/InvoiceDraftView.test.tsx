import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { InvoiceDraftView } from './InvoiceDraftView.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { InvoiceLineDTO } from '../../api/invoicing.js'

const H = 3_600_000
const LINES: InvoiceLineDTO[] = [
  {
    entryId: 'e1',
    projectId: 'p1',
    taskId: null,
    start: 1,
    durationMs: 2 * H,
    amountMinor: 20_000,
    priced: true,
    note: 'A',
  },
  {
    entryId: 'e2',
    projectId: 'p1',
    taskId: null,
    start: 2,
    durationMs: 1 * H,
    amountMinor: 10_000,
    priced: true,
    note: 'B',
  },
]

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}
const pressables = (r: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance[] =>
  r.root.findAllByType(Pressable)

describe('InvoiceDraftView', () => {
  it('InvoiceDraftView_tappingLine_reportsToggle', () => {
    const onToggle = vi.fn()
    const r = render(
      <InvoiceDraftView
        lines={LINES}
        currencyCode="EUR"
        nameByProject={new Map([['p1', 'Website']])}
        selected={new Set(['e1'])}
        onToggle={onToggle}
        onIssue={() => undefined}
      />,
    )
    const row = pressables(r).find(
      p => p.props.accessibilityRole === 'checkbox' && p.props.accessibilityLabel === 'Website',
    )!
    act(() => {
      row.props.onPress()
    })
    expect(onToggle).toHaveBeenCalledWith('e1')
  })

  it('InvoiceDraftView_emptySelection_disablesIssue', () => {
    const r = render(
      <InvoiceDraftView
        lines={LINES}
        currencyCode="EUR"
        nameByProject={new Map()}
        selected={new Set()}
        onToggle={() => undefined}
        onIssue={() => undefined}
      />,
    )
    // The issue button is the Pressable whose (disabled) state is set.
    const issue = pressables(r).find(p => p.props.accessibilityState?.disabled === true)
    expect(issue).toBeDefined()
  })

  it('InvoiceDraftView_someSelected_enablesIssueAndCallsIt', () => {
    const onIssue = vi.fn()
    const r = render(
      <InvoiceDraftView
        lines={LINES}
        currencyCode="EUR"
        nameByProject={new Map()}
        selected={new Set(['e1', 'e2'])}
        onToggle={() => undefined}
        onIssue={onIssue}
      />,
    )
    const enabled = pressables(r).filter(p => p.props.accessibilityState?.disabled !== true)
    // The last enabled pressable is the CTA (rows are checkboxes above it).
    act(() => {
      enabled[enabled.length - 1]!.props.onPress()
    })
    expect(onIssue).toHaveBeenCalledOnce()
  })
})
