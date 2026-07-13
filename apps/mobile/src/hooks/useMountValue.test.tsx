import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Text } from 'react-native'
import { useMountValue } from './useMountValue.js'

function Probe({ target }: { readonly target: number }): React.JSX.Element {
  const v = useMountValue(target)
  return <Text>{v.toFixed(2)}</Text>
}

/**
 * The reanimated shim reports reduced-motion ON in tests, so useMountValue must
 * short-circuit to its target with no animation frame — the value a consumer
 * reads on first paint is the final one, not 0.
 */
describe('useMountValue (reduced motion)', () => {
  it('useMountValue_reducedMotion_isTargetImmediately', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(<Probe target={42} />)
    })
    expect(JSON.stringify(r.toJSON())).toContain('42.00')
  })

  it('useMountValue_negativeTarget_isPreserved', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(<Probe target={-4.5} />)
    })
    expect(JSON.stringify(r.toJSON())).toContain('-4.50')
  })
})
