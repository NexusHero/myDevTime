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

/**
 * How the entry-detail panel is presented (issue #370). `docked` is a **non-modal column beside
 * the calendar** — the canvas stays visible and interactive, the master–detail shape `splitView`
 * already promises. `overlay` is the full-height sheet with a scrim, for viewports too narrow to
 * carry both.
 */
export type DetailPanelMode = 'docked' | 'overlay'

export interface DetailPanel {
  readonly mode: DetailPanelMode
  /** Panel width in points. Never negative, even on a degenerate viewport. */
  readonly width: number
}

/**
 * Panel geometry, in points.
 * - `dockMinWidth` — below this the canvas cannot keep working next to a panel, so it stays a sheet.
 *   It is exactly `minWidth + minCanvas`, so docking is never offered at the cost of the canvas.
 * - `minCanvas` — the narrowest calendar we are willing to leave standing.
 * - `overlayInset` — the gap the sheet keeps to each screen edge.
 */
export const DETAIL_PANEL = {
  minWidth: 320,
  maxWidth: 380,
  minCanvas: 520,
  dockMinWidth: 840,
  overlayInset: 24,
} as const

/** Share of the viewport the docked panel aims for, before clamping. */
const DOCK_RATIO = 0.3

/** The detail-panel decision for a viewport width — the single place the dock threshold lives. */
export function detailPanelForWidth(width: number): DetailPanel {
  if (width < DETAIL_PANEL.dockMinWidth) {
    return {
      mode: 'overlay',
      width: Math.max(0, Math.min(DETAIL_PANEL.maxWidth, width - DETAIL_PANEL.overlayInset)),
    }
  }
  const aimed = Math.round(width * DOCK_RATIO)
  return {
    mode: 'docked',
    width: Math.min(DETAIL_PANEL.maxWidth, Math.max(DETAIL_PANEL.minWidth, aimed)),
  }
}
