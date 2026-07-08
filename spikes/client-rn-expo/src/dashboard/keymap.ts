/**
 * Spike #1 · Q3 (react-native-web quality — keyboard-first dashboard) — pure logic.
 *
 * The riskiest part of "is a keyboard-first web dashboard achievable in RNW" is
 * not rendering a table; it is a coherent, testable keyboard model. RNW forwards
 * real DOM `keydown` events, so the resolver below is platform-independent: it
 * maps a key event + focus context to an intent. The view layer only dispatches
 * the intent. This is what proves the interaction design, deterministically,
 * without a browser.
 */

export type Intent =
  | 'newEntry'
  | 'editFocused'
  | 'deleteFocused'
  | 'moveDown'
  | 'moveUp'
  | 'save'
  | 'cancel'
  | 'openSearch'
  | 'none'

export interface KeyEvent {
  readonly key: string
  readonly meta: boolean // ⌘ (mac) / Ctrl (win/linux) — normalized by the caller
  readonly shift: boolean
}

export type Mode = 'list' | 'editing' | 'search'

/**
 * Resolve a key event to an intent given the current mode. Editing mode captures
 * text keys (returns `none` so the field types normally) and only reacts to the
 * commit/cancel chords; list mode drives navigation and row actions.
 */
export function resolve(ev: KeyEvent, mode: Mode): Intent {
  if (mode === 'editing') {
    if (ev.key === 'Enter' && ev.meta) return 'save'
    if (ev.key === 'Enter' && !ev.shift) return 'save'
    if (ev.key === 'Escape') return 'cancel'
    return 'none'
  }
  if (mode === 'search') {
    if (ev.key === 'Escape') return 'cancel'
    return 'none'
  }
  // list mode
  if (ev.key === '/' && !ev.meta) return 'openSearch'
  if (ev.key === 'n' && !ev.meta) return 'newEntry'
  if ((ev.key === 'e' || ev.key === 'Enter') && !ev.meta) return 'editFocused'
  if (ev.key === 'j' || ev.key === 'ArrowDown') return 'moveDown'
  if (ev.key === 'k' || ev.key === 'ArrowUp') return 'moveUp'
  if ((ev.key === 'Backspace' || ev.key === 'Delete') && ev.shift) return 'deleteFocused'
  return 'none'
}

/** Move the row cursor within `[0, count)`, clamping at the ends (no wrap). */
export function moveFocus(index: number, delta: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(count - 1, Math.max(0, index + delta))
}
