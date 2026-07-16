import { describe, expect, it } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Gauge } from '../data/Gauge.js'
import { WeekSparkline } from '../data/WeekSparkline.js'
import { Heatmap } from './Heatmap.js'
import { BoxPlot } from './BoxPlot.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Screen-reader labels on the graphical instruments (REQ-043, ADR-0062). The SVG /
 * coloured-bar instruments carry no text, so they are invisible to assistive tech
 * unless they announce their value. These pin that each exposes an `image` role with
 * a value-bearing `accessibilityLabel` (react-native-web maps this to role="img" +
 * aria-label), so a screen reader speaks the number, not silence.
 */
function render(node: React.ReactNode): string {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return JSON.stringify(r.toJSON())
}

describe('instrument screen-reader labels', () => {
  it('Gauge_announcesTheSignedValueAndRange', () => {
    const json = render(<Gauge value={2} range={10} label="Overtime" />)
    expect(json).toContain('Overtime: +2 of ±10')
  })

  it('Heatmap_announcesTheSpanAndPeak', () => {
    const json = render(
      <Heatmap
        label="Tracking"
        data={[
          { date: '2026-07-01', value: 2 },
          { date: '2026-07-02', value: 5 },
        ]}
      />,
    )
    expect(json).toContain('Tracking: activity across 2 days, peak 5')
  })

  it('BoxPlot_announcesTheFiveNumberSummary', () => {
    const json = render(<BoxPlot label="Day length" min={6} q1={7} median={8} q3={9} max={10} />)
    expect(json).toContain('Day length: median 8, interquartile 7 to 9, range 6 to 10')
  })

  it('WeekSparkline_labelsTheTrendWithItsName', () => {
    const json = render(<WeekSparkline label="Focus" data={[1, 2, 3, 2, 4]} />)
    expect(json).toContain('Focus trend')
  })
})
