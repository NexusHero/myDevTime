/**
 * Responsive layout model (issue #11) — pure width→layout math. ux-vision §3/§5:
 * tab bar on phone, sidebar + split-view (master–detail) on tablet and web. The
 * client feeds a width (points/px) and renders the chrome this returns; the
 * breakpoints live here so "phone / tablet / desktop" is one decision, tested,
 * not scattered across screens.
 */

export type LayoutClass = 'phone' | 'tablet' | 'desktop'
export type NavMode = 'tabs' | 'sidebar'

/** Lower bounds (inclusive) in points. Below `tablet` is phone. */
export const BREAKPOINTS = {
  tablet: 600,
  desktop: 1024,
} as const

export function layoutForWidth(width: number): LayoutClass {
  if (width >= BREAKPOINTS.desktop) return 'desktop'
  if (width >= BREAKPOINTS.tablet) return 'tablet'
  return 'phone'
}

export interface Chrome {
  readonly layout: LayoutClass
  /** Phone → bottom tabs; tablet/desktop → sidebar. */
  readonly navMode: NavMode
  /** Master–detail: a list and its detail sit side by side (tablet/desktop). */
  readonly splitView: boolean
}

/** The full chrome decision for a viewport width. */
export function chromeForWidth(width: number): Chrome {
  const layout = layoutForWidth(width)
  const isPhone = layout === 'phone'
  return {
    layout,
    navMode: isPhone ? 'tabs' : 'sidebar',
    splitView: !isPhone,
  }
}
