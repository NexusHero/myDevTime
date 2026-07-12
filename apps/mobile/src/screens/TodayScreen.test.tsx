// @vitest-environment jsdom
// The NL quick-add renders a react-native-web TextInput, which needs a DOM.
import { describe, expect, it } from 'vitest'
import TestRenderer from 'react-test-renderer'
import { ScrollView } from 'react-native'
import { TodayScreen } from './TodayScreen.js'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { TimerProvider } from '../timer/TimerContext.js'
import { TestQueryProvider } from '../test/TestQueryProvider.js'

function render(): TestRenderer.ReactTestRenderer {
  // Today reads the shared timer via context and its NL quick-add loads the
  // catalog through TanStack Query, so it renders inside both providers.
  return TestRenderer.create(
    <TestQueryProvider>
      <ThemeProvider>
        <TimerProvider>
          <TodayScreen />
        </TimerProvider>
      </ThemeProvider>
    </TestQueryProvider>,
  )
}

describe('TodayScreen Layout', () => {
  it('is one bounded scroll pane with bottom clearance (no floating Island on Today)', () => {
    const root = render().root
    // Exactly one scroll pane (bounded-screens rule); Today owns the clock via the
    // hero tracker, so the persistent Island is NOT rendered here (design v2).
    const scrollViews = root.findAllByType(ScrollView)
    expect(scrollViews.length).toBe(1)
    expect(scrollViews[0]!.props.contentContainerStyle.paddingBottom).toBe(40)
  })

  it('hero tracker shows the timer from the shared context (idle demo → 00:00:00, not hardcoded)', () => {
    const tree = JSON.stringify(render().toJSON())
    // Demo mode (no EXPO_PUBLIC_API_URL) starts with no running timer → 00:00:00,
    // proving the tracker reads the hook rather than the old static "00:42:11".
    expect(tree).toContain('00:00:00')
    expect(tree).not.toContain('00:42:11')
  })
})
