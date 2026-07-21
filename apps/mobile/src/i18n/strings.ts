/**
 * The tiny i18n seam (ADR-0071): Sevi speaks the user's language (de/en) without pulling a
 * localisation framework in — `pick(en, de)` chooses by device locale, and everything else
 * stays a plain string at the call site. `navigator.language` covers web *and* React Native
 * ≥ 0.76 (Hermes exposes it); when it is missing or unreadable we fall back to English rather
 * than throw — a locale read must never crash a nudge. Deliberately no new dependency
 * (`expo-localization` is not in the tree); if richer locale data is ever needed, this
 * function is the single seam to widen.
 */

/** The device's BCP-47 locale tag, or `'en'` when none can be read. */
export function deviceLocale(): string {
  try {
    const language = (globalThis.navigator as { language?: unknown } | undefined)?.language
    return typeof language === 'string' && language.length > 0 ? language : 'en'
  } catch {
    return 'en'
  }
}

/** Choose the German value on any `de*` device locale, the English one otherwise. */
export function pick<T>(en: T, de: T): T {
  return deviceLocale().toLowerCase().startsWith('de') ? de : en
}
