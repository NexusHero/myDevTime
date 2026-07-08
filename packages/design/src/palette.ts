/**
 * Color palettes (ux-vision §4) — dark-first, light a first-class sibling. Values
 * are lifted verbatim from the validated UI prototype (`spikes/ui-prototype`) so
 * the design system implements the settled visuals 1:1 (issue #11). Near-black
 * surfaces (never pure #000); one restrained accent ("Ember"); project colors are
 * the only saturated palette — the data is the color, chrome stays quiet.
 *
 * `*Soft` colors are pre-composited translucent fills expressed as `rgba(...)`
 * strings; every other value is a `#rrggbb` hex the contrast helper can parse.
 */

export interface Palette {
  /** Base canvas, below everything. */
  readonly bg: string
  /** Card/sheet surface. */
  readonly surface: string
  /** A raised surface (a card on a card). */
  readonly raised: string
  /** Popovers, menus, the Island. */
  readonly overlay: string
  readonly border: string
  readonly borderStrong: string
  /** Primary text. */
  readonly ink: string
  /** Secondary text. */
  readonly ink2: string
  /** Tertiary / disabled text. */
  readonly ink3: string
  /** The single interactive accent (now-line, running time, primary actions). */
  readonly accent: string
  /** Ink placed on top of a solid `accent` fill. */
  readonly accentInk: string
  /** Accent used as text on a normal surface (AA-tuned per theme). */
  readonly accentText: string
  readonly accentSoft: string
  readonly good: string
  readonly crit: string
  readonly goodSoft: string
  readonly critSoft: string
}

export const dark: Palette = {
  bg: '#0f1318',
  surface: '#171c23',
  raised: '#1e252e',
  overlay: '#242d38',
  border: '#2a323d',
  borderStrong: '#39434f',
  ink: '#e9edf2',
  ink2: '#9aa6b4',
  ink3: '#66707d',
  accent: '#e8a33d',
  accentInk: '#201503',
  accentText: '#e8a33d',
  accentSoft: 'rgba(232, 163, 61, 0.14)',
  good: '#57c785',
  crit: '#e5655e',
  goodSoft: 'rgba(87, 199, 133, 0.14)',
  critSoft: 'rgba(229, 101, 94, 0.14)',
}

export const light: Palette = {
  bg: '#f4f6f8',
  surface: '#ffffff',
  raised: '#ffffff',
  overlay: '#ffffff',
  border: '#dce1e8',
  borderStrong: '#c2cad4',
  ink: '#1c232c',
  ink2: '#55606d',
  ink3: '#8a94a1',
  accent: '#e8a33d',
  accentInk: '#201503',
  accentText: '#8f5e0d',
  accentSoft: 'rgba(180, 121, 27, 0.13)',
  good: '#1e8f4d',
  crit: '#c2372f',
  goodSoft: 'rgba(30, 143, 77, 0.12)',
  critSoft: 'rgba(194, 55, 47, 0.10)',
}

/**
 * The categorical project palette, per theme — CVD-checked, the only saturated
 * colors on screen. Assigned to projects deterministically (see `projectColor`).
 */
export const projectColors: Record<'dark' | 'light', readonly string[]> = {
  dark: ['#1fa894', '#8b7bf5', '#d8577c', '#3e97dd', '#7e9433'],
  light: ['#00937c', '#6d5ae0', '#c23a62', '#2374bd', '#6e8523'],
}
