import { describe, expect, it } from 'vitest'
import {
  BREAKPOINTS,
  DETAIL_PANEL,
  chromeForWidth,
  detailPanelForWidth,
  layoutForWidth,
} from './responsive.js'

describe('responsive layout model', () => {
  it('LayoutForWidth_AtBreakpoints', () => {
    expect(layoutForWidth(375)).toBe('phone') // smallest supported phone
    expect(layoutForWidth(BREAKPOINTS.tablet - 1)).toBe('phone')
    expect(layoutForWidth(BREAKPOINTS.tablet)).toBe('tablet')
    expect(layoutForWidth(BREAKPOINTS.desktop - 1)).toBe('tablet')
    expect(layoutForWidth(BREAKPOINTS.desktop)).toBe('desktop')
    expect(layoutForWidth(1440)).toBe('desktop')
  })

  it('Phone_UsesTabsNoSplit', () => {
    expect(chromeForWidth(375)).toEqual({ layout: 'phone', navMode: 'tabs', splitView: false })
  })

  it('Tablet_UsesSidebarWithSplit', () => {
    expect(chromeForWidth(800)).toEqual({ layout: 'tablet', navMode: 'sidebar', splitView: true })
  })

  it('Desktop_UsesSidebarWithSplit', () => {
    expect(chromeForWidth(1440)).toEqual({ layout: 'desktop', navMode: 'sidebar', splitView: true })
  })
})

/**
 * The entry-detail panel (issue #370): tapping a calendar entry opens its detail. On a wide
 * viewport that detail is a **docked** column beside the canvas — the calendar stays visible and
 * keeps working, the way a desktop/tablet calendar inspector behaves. Below the dock threshold
 * there is not enough room to keep both usable, so it falls back to the **overlay** sheet.
 */
describe('detailPanelForWidth', () => {
  it('Phone_IsAnOverlaySheetInset', () => {
    const p = detailPanelForWidth(375)
    expect(p.mode).toBe('overlay')
    // Inset on both sides so the sheet never touches the screen edge.
    expect(p.width).toBe(375 - 24)
  })

  it('OverlayWidthIsCappedOnMidWidths', () => {
    // Wide enough that the natural sheet exceeds the cap, still under the dock threshold.
    const p = detailPanelForWidth(DETAIL_PANEL.dockMinWidth - 1)
    expect(p.mode).toBe('overlay')
    expect(p.width).toBe(DETAIL_PANEL.maxWidth)
  })

  it('DocksAtTheThresholdAndKeepsTheCanvasUsable', () => {
    const p = detailPanelForWidth(DETAIL_PANEL.dockMinWidth)
    expect(p.mode).toBe('docked')
    expect(p.width).toBeGreaterThanOrEqual(DETAIL_PANEL.minWidth)
    // The whole point of docking: what is left over is still a workable canvas.
    expect(DETAIL_PANEL.dockMinWidth - p.width).toBeGreaterThanOrEqual(DETAIL_PANEL.minCanvas)
  })

  it('DockedWidthIsClampedBetweenMinAndMax', () => {
    expect(detailPanelForWidth(DETAIL_PANEL.dockMinWidth).width).toBe(DETAIL_PANEL.minWidth)
    expect(detailPanelForWidth(4000).width).toBe(DETAIL_PANEL.maxWidth)
    const mid = detailPanelForWidth(1200)
    expect(mid.mode).toBe('docked')
    expect(mid.width).toBeGreaterThanOrEqual(DETAIL_PANEL.minWidth)
    expect(mid.width).toBeLessThanOrEqual(DETAIL_PANEL.maxWidth)
  })

  it('NeverReturnsANegativeWidthOnDegenerateViewports', () => {
    expect(detailPanelForWidth(0).width).toBe(0)
    expect(detailPanelForWidth(10).width).toBe(0)
  })
})
