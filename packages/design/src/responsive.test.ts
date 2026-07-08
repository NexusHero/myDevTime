import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, chromeForWidth, layoutForWidth } from './responsive.js'

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
