import { describe, expect, it } from 'vitest'
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer'
import { ScrollView, View } from 'react-native'
import { TodayScreen } from './TodayScreen.js'
import { ThemeProvider } from '../theme/ThemeProvider.js'

describe('TodayScreen Layout', () => {
  it('renders the floating island and leaves scroll clearance', () => {
    const renderer = TestRenderer.create(
      <ThemeProvider>
        <TodayScreen />
      </ThemeProvider>,
    )
    const root = renderer.root

    // 1. Verify ScrollView has the correct clearance padding (SCROLL_BOTTOM_CLEARANCE = 120)
    const scrollViews = root.findAllByType(ScrollView)
    expect(scrollViews.length).toBe(1)
    expect(scrollViews[0]!.props.contentContainerStyle.paddingBottom).toBe(120)

    // 2. Verify the Floating Island is present (it renders the elapsed time and title)
    // The Island is rendered as an absolute view at the bottom
    const absoluteViews = root
      .findAllByType(View)
      .filter(
        (v: ReactTestInstance) =>
          v.props.style &&
          v.props.style.position === 'absolute' &&
          v.props.style.bottom !== undefined,
      )

    expect(absoluteViews.length).toBeGreaterThanOrEqual(1)
  })
})
