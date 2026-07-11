/**
 * Brand assets and guidelines for myDevTime.
 * Logo paths and brand metadata for use across web and mobile platforms.
 */

export const logo = {
  /** Full icon with time-block glyph (all platforms) */
  icon: '/assets/logo/icon.svg',
  /** Light-mode variant of icon */
  iconLight: '/assets/logo/icon-light.svg',
  /** Monochrome icon (for badges, small contexts) */
  iconMono: '/assets/logo/icon-mono.svg',
  /** Icon without wordmark (mark-only) */
  markGlyph: '/assets/logo/mark-glyph.svg',
  /** Wordmark (monospace, developer positioning) */
  wordmark: '/assets/logo/wordmark.svg',
  /** Horizontal lockup: mark + wordmark side-by-side */
  lockupHorizontal: '/assets/logo/lockup-horizontal.svg',
  /** Favicon (32×32, square) */
  favicon: '/assets/logo/favicon.svg',
  /** Splash screen (adaptive background, mark centered) */
  splash: '/assets/logo/splash.svg',
}

export const brandGuide = {
  name: 'myDevTime',
  tagline: 'Time tracking that scales with your work',
  domain: 'mydevtime.app',

  /** Brand colors (independent of theme) */
  brandColor: '#4f46e5', // Indigo (Blueprint accent)
  accentAmber: '#f59e0b', // Amber (playhead on canvas, now indicator)

  /** Font guidance */
  fonts: {
    display: 'Clash Display', // Titles, hero numbers, big stats
    body: 'Inter', // Paragraphs, ui text
    mono: 'JetBrains Mono', // Numerals, code, data
    accent: 'Space Grotesk', // Sovereign/Ember themes (fallback for Blueprint)
  },

  /** Spacing guidance (8pt grid) */
  gridUnit: 8,
  minTouchTarget: 44,

  /** Icon design notes */
  iconDesign: 'Three rounded time blocks in project colors, crossed by amber "now" playhead',
  wordmarkStyle: 'Monospace, developer positioning (same as body font)',
}
