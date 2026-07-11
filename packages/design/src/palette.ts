/**
 * Color palettes (ux-vision §4) — dark-first, light a first-class sibling, now
 * across **three swappable accent themes** (ADR-0022): **Blueprint** (royal blue
 * "Königsblau" `#2563EB`, the default — ADR-0023), **Sovereign** (indigo royal
 * blue) and **Ember** (vivid signal orange `#FF5320` — an evolution of the
 * validated "now/live" amber, pushed to full signal energy after the user tests).
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

/** The three accent themes. Blueprint (Königsblau) is the default (ADR-0023). */
export type AccentTheme = 'sovereign' | 'ember' | 'blueprint'

/** All accent themes, in historical order; the default is `DEFAULT_ACCENT`. */
export const ACCENT_THEMES = ['sovereign', 'ember', 'blueprint'] as const

/** The default accent — Blueprint / "Königsblau" (ADR-0023, superseding ADR-0022). */
export const DEFAULT_ACCENT: AccentTheme = 'blueprint'

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
  /**
   * The "now / live / running" signal — theme-independent orange (ux-vision §4,
   * design-system rule). It means exactly one thing: something is happening right
   * now (running timer, now-line, REC dot, logo playhead). Never decorative, and
   * never the accent: under Blueprint/Sovereign the accent is blue/purple, but
   * "live" stays orange in all six accent × mode combinations.
   */
  readonly live: string
  /** Soft `live` wash for pill/banner backgrounds. */
  readonly liveSoft: string
  /** `live` tuned to clear WCAG AA-Large as text on a normal surface. */
  readonly liveStrong: string
  /**
   * Soft background wash behind AI-proposal surfaces (AICallout). Pre-blended
   * over the mode's bg (ADR-0026 §3), theme-independent like `live`.
   */
  readonly aiSoft: string
  /**
   * AI-signature ink — the violet used for AI-proposal titles/marks on `aiSoft`.
   * Part of the "this came from AI, you decide" visual contract (ADR-0005/0034).
   */
  readonly aiInk: string
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
  good: '#4ade80',
  crit: '#e5655e',
  warn: '#d9903f',
  goodSoft: '#1a2c29',
  critSoft: '#2e1e23',
  warnSoft: '#302720',
  live: '#ff6b3d',
  liveSoft: '#362120',
  liveStrong: '#ff5320',
  aiSoft: '#1f1a35',
  aiInk: '#a9a2ff',
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
  good: '#16a34a',
  crit: '#c2372f',
  warn: '#b45309',
  goodSoft: '#e4f1e9',
  critSoft: '#f9ebea',
  warnSoft: '#f6eae1',
  live: '#ff5320',
  liveSoft: '#ffeae4',
  liveStrong: '#e33e0f',
  aiSoft: '#f3f2fd',
  aiInk: '#4a3fd6',
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
      accentSoft: '#ebedfb',
    },
    dark: {
      accent: '#3654e0',
      accentInk: '#ffffff',
      accentText: '#90a0ff',
      accentSoft: '#242a3f',
    },
  },
  ember: {
    // Vivid signal orange (`#ff5320`) after the user tests — was warm amber.
    // The fill carries white ink; light `accentText` darkens to the 700 shade
    // (`#b33009`) to clear AA as text on a normal surface.
    light: {
      accent: '#ff5320',
      accentInk: '#ffffff',
      accentText: '#b33009',
      accentSoft: '#ffede6',
    },
    dark: {
      accent: '#ff5320',
      accentInk: '#ffffff',
      accentText: '#ff7a52',
      accentSoft: '#33201a',
    },
  },
  blueprint: {
    light: {
      accent: '#2563eb',
      accentInk: '#ffffff',
      accentText: '#2563eb',
      accentSoft: '#e9effd',
    },
    dark: {
      accent: '#2563eb',
      accentInk: '#ffffff',
      accentText: '#60a5fa',
      accentSoft: '#1c2a3d',
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

/** The default-accent (Blueprint) palettes, exported for convenience; track `DEFAULT_ACCENT`. */
export const dark: Palette = palettes[DEFAULT_ACCENT].dark
export const light: Palette = palettes[DEFAULT_ACCENT].light

/**
 * The AI-signature gradient (theme-independent, like `live`) — blue→violet→orange,
 * "plan meets now". Every AI proposal (Co-Planner, Assistant, insights, briefings)
 * wears it — as a tri-stop rail or a ✦ chip; deterministic UI never does. It is the
 * "this came from AI, you decide" marker (ADR-0005: proposals, never actions; 0034).
 */
export const AI_GRADIENT = ['#3654e0', '#7a44d8', '#ff5320'] as const

/**
 * The categorical project palette, per mode — CVD-checked, the only saturated
 * colors on screen. Accent-independent (a project keeps its identity when the
 * accent theme flips). Assigned to projects deterministically (see `projectColor`).
 */
export const projectColors: Record<'dark' | 'light', readonly string[]> = {
  dark: [
    '#1fa894',
    '#8b7bf5',
    '#d8577c',
    '#3e97dd',
    '#7e9433',
    '#d48a39',
    '#cfa63a',
    '#4aa46f',
    '#b568b2',
    '#449fa6',
    '#88909e',
    '#cc5e5e',
  ],
  light: [
    '#00937c',
    '#6d5ae0',
    '#c23a62',
    '#2374bd',
    '#6e8523',
    '#bd7122',
    '#b58c21',
    '#2f8754',
    '#9e529b',
    '#288188',
    '#6f7887',
    '#b54242',
  ],
}
