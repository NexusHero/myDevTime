// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { FillWeekPreview, type FillWeekGhost } from './FillWeekPreview.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the fill-week review sheet (REQ-073): the whole `packWeek`
 * result renders as dashed ghost rows, the unplaced remainder is an honest, visible count,
 * ONE Confirm hands everything back to the caller, and Dismiss is a pure drop — it calls
 * only `onDismiss`, never the confirm.
 */

const GHOSTS: readonly FillWeekGhost[] = [
  { day: '2026-07-20', dayLabel: '20.07.', startMin: 480, lenMin: 120, title: 'Fix login' },
  { day: '2026-07-20', dayLabel: '20.07.', startMin: 600, lenMin: 60, title: 'Write docs' },
  { day: '2026-07-21', dayLabel: '21.07.', startMin: 480, lenMin: 30, title: 'Write docs' },
]

function render(
  props: Partial<Parameters<typeof FillWeekPreview>[0]> = {},
): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <FillWeekPreview
          ghosts={GHOSTS}
          unplacedCount={0}
          busy={false}
          onConfirm={() => undefined}
          onDismiss={() => undefined}
          {...props}
        />
      </ThemeProvider>,
    )
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

function pressButton(r: TestRenderer.ReactTestRenderer, label: string): void {
  const target = r.root.findAllByType(Pressable).find(p =>
    p
      .findAll(n => typeof n.type === 'string')
      .flatMap(n => n.children)
      .some(c => typeof c === 'string' && c.includes(label)),
  )
  expect(target, `no pressable containing "${label}"`).toBeDefined()
  act(() => {
    ;(target?.props as { onPress: () => void }).onPress()
  })
}

describe('FillWeekPreview', () => {
  it('Preview_RendersEveryGhostWithDayTimeAndTitle', () => {
    const r = render()
    const all = texts(r)
    expect(all).toContain('20.07. 08:00–10:00')
    expect(all).toContain('Fix login')
    // The 60-minute default block is visible as such.
    expect(all).toContain('20.07. 10:00–11:00')
    expect(all).toContain('1:00 h')
    // A ≥30-min split fragment on the next day renders too.
    expect(all).toContain('21.07. 08:00–08:30')
  })

  it('Preview_UnplacedCount_IsAnHonestVisibleNotice', () => {
    expect(texts(render({ unplacedCount: 3 }))).toContain("3 don't fit this week")
    expect(texts(render({ unplacedCount: 1 }))).toContain("1 doesn't fit this week")
    expect(texts(render({ unplacedCount: 0 }))).not.toContain('fit this week')
  })

  it('Preview_OneConfirm_CallsTheCallerExactlyOnce', () => {
    const onConfirm = vi.fn()
    const r = render({ onConfirm })
    pressButton(r, 'Confirm plan')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Preview_Dismiss_CallsOnlyOnDismissAndNeverConfirms', () => {
    const onConfirm = vi.fn()
    const onDismiss = vi.fn()
    const r = render({ onConfirm, onDismiss })
    pressButton(r, 'Dismiss')
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Preview_EmptyGhosts_DisablesConfirmAndSaysNothingFits', () => {
    const onConfirm = vi.fn()
    const r = render({ ghosts: [], onConfirm })
    expect(texts(r)).toContain('Nothing fits this week.')
    // The confirm button is disabled — pressing must not fire (Button gates onPress upstream,
    // so assert the disabled state on the rendered pressable's accessibility contract).
    const confirm = r.root.findAllByType(Pressable).find(p =>
      p
        .findAll(n => typeof n.type === 'string')
        .flatMap(n => n.children)
        .some(c => typeof c === 'string' && c.includes('Confirm plan')),
    )
    expect(confirm?.props as object).toMatchObject({
      accessibilityState: expect.objectContaining({ disabled: true }) as object,
    })
  })
})
