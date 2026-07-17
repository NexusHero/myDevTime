import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Text } from 'react-native'
import { RoleProvider, useVisibility, type RoleValue } from './RoleContext.js'

/**
 * The client role→visibility wiring (REQ-056, design v14 §R): the provider runs the chosen
 * role through the domain resolver, so a Stempler (employee) hides money while Health always
 * shows, and switching the role re-derives the visible set live.
 */
describe('RoleProvider + useVisibility', () => {
  it('Employee_HidesMoney_ShowsHealthAndWorkTime', () => {
    const box: { value: RoleValue | null } = { value: null }
    function Probe(): React.JSX.Element {
      box.value = useVisibility()
      return <Text>probe</Text>
    }
    act(() => {
      TestRenderer.create(
        <RoleProvider initialRole="employee">
          <Probe />
        </RoleProvider>,
      )
    })
    const v = box.value
    expect(v).not.toBeNull()
    expect(v!.isVisible('invoicing')).toBe(false)
    expect(v!.isVisible('clients')).toBe(false)
    expect(v!.isVisible('health')).toBe(true)
    expect(v!.isVisible('punch_clock')).toBe(true)
  })

  it('SwitchingRoleToFreelancer_RevealsMoney', () => {
    const box: { value: RoleValue | null } = { value: null }
    function Probe(): React.JSX.Element {
      box.value = useVisibility()
      return <Text>probe</Text>
    }
    act(() => {
      TestRenderer.create(
        <RoleProvider initialRole="employee">
          <Probe />
        </RoleProvider>,
      )
    })
    expect(box.value!.isVisible('invoicing')).toBe(false)
    act(() => {
      box.value!.setRole('freelancer')
    })
    expect(box.value!.isVisible('invoicing')).toBe(true)
  })
})
