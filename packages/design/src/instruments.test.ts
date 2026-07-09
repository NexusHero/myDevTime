import { describe, expect, it } from 'vitest'
import { gaugeAngle, polarToCartesian, ringDashOffset, sparklinePoints } from './instruments.js'

describe('ringDashOffset', () => {
  it('ringDashOffset_Half_LeavesHalfPainted', () => {
    expect(ringDashOffset(0.5, 100)).toBe(50)
  })

  it('ringDashOffset_Full_IsZero', () => {
    expect(ringDashOffset(1, 100)).toBe(0)
  })

  it('ringDashOffset_Empty_IsWholeCircumference', () => {
    expect(ringDashOffset(0, 100)).toBe(100)
  })

  it('ringDashOffset_OverBudget_ClampsToFull', () => {
    expect(ringDashOffset(1.4, 100)).toBe(0)
  })

  it('ringDashOffset_Negative_ClampsToEmpty', () => {
    expect(ringDashOffset(-0.3, 100)).toBe(100)
  })
})

describe('gaugeAngle', () => {
  it('gaugeAngle_Zero_PointsUp', () => {
    expect(gaugeAngle(0, 10)).toBe(0)
  })

  it('gaugeAngle_PositiveMax_PointsRight', () => {
    expect(gaugeAngle(10, 10)).toBe(90)
  })

  it('gaugeAngle_NegativeMax_PointsLeft', () => {
    expect(gaugeAngle(-10, 10)).toBe(-90)
  })

  it('gaugeAngle_Midway_IsHalfDeflection', () => {
    expect(gaugeAngle(5, 10)).toBe(45)
  })

  it('gaugeAngle_BeyondRange_Clamps', () => {
    expect(gaugeAngle(25, 10)).toBe(90)
    expect(gaugeAngle(-25, 10)).toBe(-90)
  })

  it('gaugeAngle_ZeroRange_IsZero', () => {
    expect(gaugeAngle(5, 0)).toBe(0)
  })
})

describe('polarToCartesian', () => {
  it('polarToCartesian_Up_IsTopOfCircle', () => {
    const p = polarToCartesian(50, 50, 40, 0)
    expect(p.x).toBeCloseTo(50)
    expect(p.y).toBeCloseTo(10)
  })

  it('polarToCartesian_Right_IsRightOfCircle', () => {
    const p = polarToCartesian(50, 50, 40, 90)
    expect(p.x).toBeCloseTo(90)
    expect(p.y).toBeCloseTo(50)
  })

  it('polarToCartesian_Left_IsLeftOfCircle', () => {
    const p = polarToCartesian(50, 50, 40, -90)
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(50)
  })
})

describe('sparklinePoints', () => {
  it('sparklinePoints_Series_MapsMinToBottomMaxToTop', () => {
    expect(sparklinePoints([1, 2, 3], 100, 10)).toBe('0,10 50,5 100,0')
  })

  it('sparklinePoints_Flat_SitsOnMidline', () => {
    expect(sparklinePoints([5, 5], 100, 10)).toBe('0,5 100,5')
  })

  it('sparklinePoints_Single_IsOneMidPoint', () => {
    expect(sparklinePoints([7], 100, 10)).toBe('0,5')
  })

  it('sparklinePoints_Empty_IsEmptyString', () => {
    expect(sparklinePoints([], 100, 10)).toBe('')
  })
})
