/**
 * WCAG 2.1 contrast math (pure) — the structural enforcement behind ux-vision
 * §4's "WCAG AA contrast in both themes". The palette's a11y contract is a *test*
 * (see contrast.test.ts) that asserts ink-on-surface clears AA in light and dark,
 * so a future token tweak that breaks contrast fails the build rather than
 * shipping. Parses `#rgb`/`#rrggbb`; translucent `rgba(...)` tokens are not
 * contrast-testable on their own and are excluded by the caller.
 */

/** AA thresholds. */
export const AA_NORMAL = 4.5
export const AA_LARGE = 3

function expand(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return h
      .split('')
      .map(c => c + c)
      .join('')
  }
  return h
}

/** Parse `#rgb`/`#rrggbb` to 0–255 channels. Throws on anything else. */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = expand(hex)
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex color: ${hex}`)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function linearize(channel8: number): number {
  const c = channel8 / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance (WCAG) of a hex color, 0 (black) – 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** Contrast ratio between two hex colors, 1 – 21. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Does the pair meet the given AA threshold (normal text by default)? */
export function meetsAA(a: string, b: string, threshold: number = AA_NORMAL): boolean {
  return contrastRatio(a, b) >= threshold
}
