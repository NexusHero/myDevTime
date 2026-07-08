import { describe, expect, it } from 'vitest'
import { resolveMode } from './resolveMode'

describe('theme mode resolution', () => {
  it('ExplicitPreference_OverridesOsScheme', () => {
    expect(resolveMode('dark', 'light')).toBe('dark')
    expect(resolveMode('light', 'dark')).toBe('light')
  })

  it('System_FollowsOsScheme', () => {
    expect(resolveMode('system', 'light')).toBe('light')
    expect(resolveMode('system', 'dark')).toBe('dark')
  })

  it('System_WithUnknownOsScheme_DefaultsToDarkFirst', () => {
    expect(resolveMode('system', null)).toBe('dark')
  })
})
