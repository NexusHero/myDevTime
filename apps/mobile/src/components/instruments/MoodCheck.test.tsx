import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { MoodCheck } from './MoodCheck.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}

const texts = (r: TestRenderer.ReactTestRenderer): string => JSON.stringify(r.toJSON())

describe('MoodCheck', () => {
  it('MoodCheck_initialRender_offersThreeMoodsAndSkip', () => {
    const r = render(<MoodCheck />)
    const buttons = r.root.findAllByType(Pressable)
    const labels = buttons.map(b => b.props.accessibilityLabel as string)
    expect(labels).toEqual(['Gut', 'Angespannt', 'Gestresst', 'Überspringen'])
    expect(texts(r)).toContain('wie war der Block?')
  })

  it('MoodCheck_pickMood_showsQuietConfirmationAndReportsChange', () => {
    const onChange = vi.fn()
    const r = render(<MoodCheck onChange={onChange} />)
    const gut = r.root.findAllByType(Pressable).find(b => b.props.accessibilityLabel === 'Gut')!
    act(() => {
      gut.props.onPress()
    })
    expect(onChange).toHaveBeenCalledWith('good')
    expect(texts(r)).toContain('Notiert')
    // Options are gone once picked — the row is now just the acknowledgement.
    expect(r.root.findAllByType(Pressable)).toHaveLength(0)
  })

  it('MoodCheck_skip_dismissesViaOnDone', () => {
    const onDone = vi.fn()
    const r = render(<MoodCheck onDone={onDone} />)
    const skip = r.root
      .findAllByType(Pressable)
      .find(b => b.props.accessibilityLabel === 'Überspringen')!
    act(() => {
      skip.props.onPress()
    })
    expect(onDone).toHaveBeenCalledOnce()
  })
})
