import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { pickBanner } from '@mydevtime/domain'
import { ContextBanner, type ContextBannerProps } from './ContextBanner.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the one contextual Planner banner (design v14 §M2): a single
 * component with a `variant` prop, its title/body/actions rendered, and — with `pickBanner` —
 * only the highest-priority candidate shown, never a stack.
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

function instanceText(node: TestRenderer.ReactTestInstance): string {
  return node
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

function pressText(r: TestRenderer.ReactTestRenderer, label: string): void {
  const p = r.root.findAllByType(Pressable).find(x => instanceText(x).includes(label))
  expect(p, `pressable "${label}"`).toBeDefined()
  act(() => {
    p!.props.onPress()
  })
}

describe('ContextBanner', () => {
  it('ContextBanner_healing_showsTitleBodyAndFiresAction', () => {
    const onAdopt = vi.fn()
    const r = render(
      <ContextBanner
        variant="healing"
        title="Yesterday: 40 min unbooked"
        body="The Auto-Tracker saw VS Code but nothing was booked."
        actions={[{ label: 'Adopt', onPress: onAdopt }]}
      />,
    )
    const all = texts(r)
    expect(all).toContain('Yesterday: 40 min unbooked')
    expect(all).toContain('The Auto-Tracker saw VS Code')
    pressText(r, 'Adopt')
    expect(onAdopt).toHaveBeenCalledOnce()
  })

  it('ContextBanner_note_prependsTheLeadGlyph', () => {
    const r = render(<ContextBanner variant="note" title="Week filled" leadGlyph="✦" />)
    expect(texts(r)).toContain('✦ Week filled')
  })
})

describe('pickBanner gating (the §M2 rule)', () => {
  const healing: ContextBannerProps = { variant: 'healing', title: 'Yesterday unbooked' }
  const note: ContextBannerProps = { variant: 'note', title: 'Week filled' }

  it('RendersOnlyTheHighestPriorityCandidate_HealingBeatsNote', () => {
    const winner = pickBanner([note, healing])
    expect(winner?.variant).toBe('healing')
    const r = render(<>{winner !== null && <ContextBanner {...winner} />}</>)
    const all = texts(r)
    expect(all).toContain('Yesterday unbooked')
    expect(all).not.toContain('Week filled')
  })

  it('RendersNothingWhenNoCandidate', () => {
    const winner = pickBanner<ContextBannerProps>([])
    const r = render(<>{winner !== null && <ContextBanner {...winner} />}</>)
    expect(r.toJSON()).toBeNull()
  })
})
