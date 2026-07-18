// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Platform } from 'react-native'
import { theme } from '@mydevtime/design'
import { focusRingStyle } from './focusRing.js'

/**
 * Unit tests for the visible focus ring (REQ-043, ADR-0062): on web a focused
 * control gets the 2px accent outline and an unfocused one suppresses the UA
 * default; on native the helper is a no-op either way.
 */
const t = theme('dark')

describe('focusRingStyle', () => {
  const originalOS = Platform.OS
  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  it('Web_Focused_DrawsTheAccentOutline', () => {
    expect(focusRingStyle(t, true)).toEqual({
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineColor: t.color.accent,
      outlineOffset: 2,
    })
  })

  it('Web_Unfocused_SuppressesTheDefaultOutline', () => {
    expect(focusRingStyle(t, false)).toEqual({ outlineStyle: 'none' })
  })

  it('Native_ReturnsNoStyle_FocusedOrNot', () => {
    ;(Platform as { OS: string }).OS = 'ios'
    expect(focusRingStyle(t, true)).toEqual({})
    expect(focusRingStyle(t, false)).toEqual({})
  })
})
