// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { TaskEstimateCard } from './TaskEstimateCard.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the effort-estimation card (REQ-041): with a category + complexity
 * it shows the deterministic baseline range and estimate-vs-actual; without them it says so; and
 * saving hands the raw inputs (category, complexity, estimate in minutes) to the Planner.
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
function pressLabel(r: TestRenderer.ReactTestRenderer, label: string): void {
  const p = r.root.findAllByType(Pressable).find(x => x.props.accessibilityLabel === label)
  expect(p, label).toBeDefined()
  act(() => {
    p!.props.onPress()
  })
}

describe('TaskEstimateCard', () => {
  it('NoCategory_ShowsThePrompt', () => {
    const out = texts(
      render(
        <TaskEstimateCard
          category={null}
          complexity={null}
          estimateMinutes={null}
          spentMs={0}
          onSave={() => {}}
        />,
      ),
    )
    expect(out).toContain('Pick a category and complexity')
  })

  it('WithCategoryAndComplexity_ShowsBaselineAndVsActual', () => {
    const out = texts(
      render(
        <TaskEstimateCard
          category="feature"
          complexity="medium"
          estimateMinutes={240}
          spentMs={18_000_000} // 5.0 h tracked
          onSave={() => {}}
        />,
      ),
    )
    expect(out).toContain('Baseline')
    expect(out).toContain('Estimate 4.0 h (user)')
    expect(out).toContain('Actual 5.0 h')
  })

  it('Save_EmitsRawInputsIncludingEstimateMinutes', () => {
    const onSave = vi.fn()
    const r = render(
      <TaskEstimateCard
        category="feature"
        complexity="small"
        estimateMinutes={120}
        spentMs={0}
        onSave={onSave}
      />,
    )
    pressLabel(r, 'Save estimate')
    expect(onSave).toHaveBeenCalledWith({
      category: 'feature',
      complexity: 'small',
      estimateMinutes: 120,
    })
  })
})
