import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceLocale, pick } from './strings.js'

/**
 * The tiny i18n seam (ADR-0071): `pick(en, de)` chooses by device locale — any `de*` locale
 * gets the German string, everything else (including an absent/unreadable locale) falls back
 * to English. No dependency, no throw: Sevi's voice must never crash over a locale read.
 */
describe('pick', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubLanguage(language: string | undefined) {
    vi.stubGlobal('navigator', language === undefined ? {} : { language })
  }

  it('GermanLocale_PicksTheGermanValue', () => {
    stubLanguage('de-DE')
    expect(pick('Take a break', 'Mach eine Pause')).toBe('Mach eine Pause')
    expect(deviceLocale()).toBe('de-DE')
  })

  it('PlainGermanTag_AlsoPicksGerman', () => {
    stubLanguage('de')
    expect(pick('en', 'de')).toBe('de')
  })

  it('NonGermanLocale_FallsBackToEnglish', () => {
    stubLanguage('fr-FR')
    expect(pick('Take a break', 'Mach eine Pause')).toBe('Take a break')
  })

  it('MissingNavigatorLanguage_FallsBackToEnglishWithoutThrowing', () => {
    stubLanguage(undefined)
    expect(pick('en', 'de')).toBe('en')
    expect(deviceLocale()).toBe('en')
  })

  it('WorksForNonStringValues', () => {
    stubLanguage('de-AT')
    expect(pick({ label: 'Break' }, { label: 'Pause' })).toEqual({ label: 'Pause' })
  })
})
