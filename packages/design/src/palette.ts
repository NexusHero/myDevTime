/**
 * Color palettes (ux-vision §4) — dark-first, light a first-class sibling, now
 * across **three swappable accent themes** (ADR-0022): **Sovereign** (royal blue,
 * flagship default), **Ember** (the validated "now/live" amber from the binding UX
 * vision) and **Blueprint** (myJob's steel blue, ported for family resemblance).
 *
 * The design system separates two independent axes (mirroring the source design
 * project's `colors.css` × `modes.css` split): the **neutral** surfaces/inks and
 * status colors depend only on the *mode* (light/dark) and are shared across every
 * accent; only the four **accent** tokens depend on the *accent theme*. A resolved
 * `Palette` is `neutral(mode)` composited with `accent(theme, mode)`, so any
 * component works unmodified under all six combinations.
 *
 * Values are lifted from the validated UI prototype and the settled design tokens
 * so the system implements the visuals 1:1 (issue #11). Near-black surfaces (never
 * pure #000); project colors are the only saturated palette — the data is the
 * color, chrome stays quiet. `*Soft` colors are pre-composited translucent fills
 * expressed as `rgba(...)` strings; every other value is a `#rrggbb` hex the
 * contrast helper can parse.
 */

/** The three accent themes. Sovereign is the flagship default (ADR-0022). */
export type AccentTheme = 'sovereign' | 'ember' | 'blueprint'

/** All accent themes, in canonical order (Sovereign first — the default). */
export const ACCENT_THEMES = ['sovereign', 'ember', 'blueprint'] as const

/** The flagship default accent (ADR-0022). */
export const DEFAULT_ACCENT: AccentTheme = 'sovereign'

export interface Palette {
  /** Base canvas, below everything. */
  readonly bg: string
  /** Card/sheet surface. */
  readonly surface: string
  /** A raised surface (a card on a card). */
  readonly raised: string
  /** A recessed/sunk surface (badge fills, instrument tracks). */
  readonly sunk: string
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
  /** Accent used as text on a normal surface (AA-tuned per accent × mode). */
  readonly accentText: string
  readonly accentSoft: string
  readonly good: string
  readonly crit: string
  /** Warning tone — only used where a threshold sits *between* good and critical
   * (the budget ring's 80% band). Status stays otherwise two-value (ux-vision §4). */
  readonly warn: string
  readonly goodSoft: string
  readonly critSoft: string
  readonly warnSoft: string
}

/** The mode-dependent, accent-independent half of a palette. */
type Neutrals = Omit<Palette, 'accent' | 'accentInk' | 'accentText' | 'accentSoft'>

/** The accent-dependent half of a palette. */
type Accent = Pick<Palette, 'accent' | 'accentInk' | 'accentText' | 'accentSoft'>

const neutralDark: Neutrals = {
  bg: '#0a0c11',
  surface: '#10131a',
  raised: '#171c27',
  sunk: '#1b2130',
  overlay: '#171c27',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  ink: '#eef1f6',
  ink2: '#9aa6b4',
  ink3: '#66707d',
  good: '#57c785',
  crit: '#e5655e',
  warn: '#d9903f',
  goodSoft: 'rgba(87, 199, 133, 0.14)',
  critSoft: 'rgba(229, 101, 94, 0.14)',
  warnSoft: 'rgba(217, 144, 63, 0.16)',
}

const neutralLight: Neutrals = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  raised: '#ffffff',
  sunk: '#f1f5f9',
  overlay: '#ffffff',
  border: '#e5e9ef',
  borderStrong: '#cbd2dc',
  ink: '#101828',
  ink2: '#475467',
  ink3: '#98a2b3',
  good: '#1e8f4d',
  crit: '#c2372f',
  warn: '#b45309',
  goodSoft: 'rgba(30, 143, 77, 0.12)',
  critSoft: 'rgba(194, 55, 47, 0.10)',
  warnSoft: 'rgba(180, 83, 9, 0.12)',
}

/**
 * Accent tokens per theme × mode. `accent` is the solid interactive fill (kept as
 * the 500 shade in both modes, matching the source tokens); `accentText` is the
 * accent used *as text* on a normal surface, tuned to clear WCAG AA there (light
 * mode darkens Ember to its 700 shade; dark mode uses the brighter on-dark tint).
 */
const accents: Record<AccentTheme, { readonly dark: Accent; readonly light: Accent }> = {
  sovereign: {
    light: {
      accent: '#3654e0',
      accentInk: '#ffffff',
      accentText: '#3654e0',
      accentSoft: 'rgba(54, 84, 224, 0.10)',
    },
    dark: {
      accent: '#3654e0',
      accentInk: '#ffffff',
      accentText: '#90a0ff',
      accentSoft: 'rgba(144, 160, 255, 0.16)',
    },
  },
  ember: {
    light: {
      accent: '#e8a33d',
      accentInk: '#201503',
      accentText: '#8f5e0d',
      accentSoft: 'rgba(180, 121, 27, 0.13)',
    },
    dark: {
      accent: '#e8a33d',
      accentInk: '#201503',
      accentText: '#e8a33d',
      accentSoft: 'rgba(232, 163, 61, 0.14)',
    },
  },
  blueprint: {
    light: {
      accent: '#2563eb',
      accentInk: '#ffffff',
      accentText: '#2563eb',
      accentSoft: 'rgba(37, 99, 235, 0.10)',
    },
    dark: {
      accent: '#2563eb',
      accentInk: '#ffffff',
      accentText: '#60a5fa',
      accentSoft: 'rgba(96, 165, 250, 0.16)',
    },
  },
}

function compose(neutral: Neutrals, accent: Accent): Palette {
  return { ...neutral, ...accent }
}

/**
 * Every accent × mode combination, pre-resolved. `palettes[accent][mode]` is the
 * `Palette` a client reads; the resolver (`theme`) just selects from here.
 */
export const palettes: Record<AccentTheme, { readonly dark: Palette; readonly light: Palette }> = {
  sovereign: {
    dark: compose(neutralDark, accents.sovereign.dark),
    light: compose(neutralLight, accents.sovereign.light),
  },
  ember: {
    dark: compose(neutralDark, accents.ember.dark),
    light: compose(neutralLight, accents.ember.light),
  },
  blueprint: {
    dark: compose(neutralDark, accents.blueprint.dark),
    light: compose(neutralLight, accents.blueprint.light),
  },
}

/** The default-accent (Sovereign) palettes, exported for convenience. */
export const dark: Palette = palettes.sovereign.dark
export const light: Palette = palettes.sovereign.light

/**
 * The categorical project palette, per mode — CVD-checked, the only saturated
 * colors on screen. Accent-independent (a project keeps its identity when the
 * accent theme flips). Assigned to projects deterministically (see `projectColor`).
 */
export const projectColors: Record<'dark' | 'light', readonly string[]> = {
  dark: ['#1fa894', '#8b7bf5', '#d8577c', '#3e97dd', '#7e9433'],
  light: ['#00937c', '#6d5ae0', '#c23a62', '#2374bd', '#6e8523'],
}
