/**
 * Presentation-layer number formatting (ux-vision §4, issue #11). Durations and
 * amounts are "the product" — they must render in tabular/monospace numerals and
 * read the same on every screen — so the formatting lives here, pure and
 * platform-agnostic, next to the tokens that style it (`fontFamily.numeric`).
 *
 * These functions never touch `Intl`/locale: the output must be identical on a
 * phone, in a snapshot, and in a signed export, so grouping and separators are
 * fixed here. Domain math (durations in ms, money in integer minor units) is
 * computed elsewhere (ADR-0005); this layer only renders it.
 */

/** Round half-up, sign-aware, so −0.5 → −1 and 0.5 → 1 (deterministic). */
function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n))
}

/** Group an integer's digits into thousands with `,` (e.g. 1250 → "1,250"). */
function groupThousands(intPart: number): string {
  const digits = String(Math.abs(Math.trunc(intPart)))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits.charAt(i)
  }
  return out
}

/**
 * A duration in milliseconds as `H:MM` (hours uncapped, minutes always two
 * digits): `5_400_000 → "1:30"`, `90_000_000 → "25:00"`. Rounded to the nearest
 * minute. A negative duration (e.g. an overtime deficit) keeps a leading `−`.
 */
export function formatDuration(ms: number): string {
  const totalMinutes = roundHalfUp(ms / 60_000)
  const sign = totalMinutes < 0 ? '−' : ''
  const abs = Math.abs(totalMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `${sign}${String(hours)}:${String(minutes).padStart(2, '0')}`
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
}

/**
 * An amount in integer minor units (cents) as a grouped decimal with its currency
 * symbol: `formatMoneyMinor(125000, 'EUR') → "€1,250.00"`. Two-decimal currencies
 * only (all we bill in); an unknown code renders as a prefix (`"CHF 5.00"`). A
 * negative amount takes a leading `−` before the symbol.
 */
export function formatMoneyMinor(minor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency]
  const prefix = symbol ?? `${currency} `
  const sign = minor < 0 ? '−' : ''
  const abs = Math.abs(Math.trunc(minor))
  const major = Math.floor(abs / 100)
  const cents = abs % 100
  return `${sign}${prefix}${groupThousands(major)}.${String(cents).padStart(2, '0')}`
}

/**
 * A ratio (0..1+) as a whole-percent string: `0.723 → "72%"`, `1.2 → "120%"`.
 * Not clamped — over-budget reads as `> 100%` on purpose.
 */
export function formatPercent(ratio: number): string {
  return `${String(roundHalfUp(ratio * 100))}%`
}

/** Badge/indicator tone for a consumption ratio: calm until 80%, then warn, then crit. */
export type ConsumptionTone = 'good' | 'warn' | 'crit'

export function budgetTone(ratio: number): ConsumptionTone {
  if (ratio >= 1) return 'crit'
  if (ratio >= 0.8) return 'warn'
  return 'good'
}

/** The fill fraction for a consumption bar: the ratio clamped to `[0, 1]`. */
export function barFraction(ratio: number): number {
  return Math.max(0, Math.min(1, ratio))
}
