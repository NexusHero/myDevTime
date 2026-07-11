import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import { parseTimeEntry } from './parse.js'

/**
 * The deterministic natural-language pre-parser (REQ-013, ADR-0005): it turns
 * "2h Finanzo review gestern" into a *draft* the user confirms — never persists.
 * Pure and reproducible; the LLM is only a fallback for what this can't parse
 * (ADR-0029), and even then the result is a draft, never a written entry.
 */
describe('parseTimeEntry — duration', () => {
  it('ReadsHoursWithDecimalsInBothLocales', () => {
    expect(parseTimeEntry('1.5h Finanzo')?.durationMs).toBe(90 * MINUTE_MS)
    expect(parseTimeEntry('1,5h Finanzo')?.durationMs).toBe(90 * MINUTE_MS)
    expect(parseTimeEntry('2 Stunden Finanzo')?.durationMs).toBe(2 * HOUR_MS)
  })
  it('ReadsMinutesAndClockStyle', () => {
    expect(parseTimeEntry('90m review')?.durationMs).toBe(90 * MINUTE_MS)
    expect(parseTimeEntry('30 min review')?.durationMs).toBe(30 * MINUTE_MS)
    expect(parseTimeEntry('1:30 review')?.durationMs).toBe(90 * MINUTE_MS)
  })
  it('SumsCombinedHoursAndMinutes', () => {
    expect(parseTimeEntry('2h 30m Finanzo')?.durationMs).toBe(150 * MINUTE_MS)
    expect(parseTimeEntry('1 Std 15 min')?.durationMs).toBe(75 * MINUTE_MS)
  })
  it('ReturnsNullWithoutADuration', () => {
    expect(parseTimeEntry('worked on Finanzo yesterday')).toBeNull()
  })
})

describe('parseTimeEntry — day', () => {
  it('DefaultsToTodayZeroOffset', () => {
    expect(parseTimeEntry('2h Finanzo')?.dayOffset).toBe(0)
  })
  it('ReadsYesterdayInBothLocales', () => {
    expect(parseTimeEntry('2h Finanzo yesterday')?.dayOffset).toBe(-1)
    expect(parseTimeEntry('2h Finanzo gestern')?.dayOffset).toBe(-1)
  })
})

describe('parseTimeEntry — project & note', () => {
  it('ReadsAProjectHintFromKeywordsAndSigils', () => {
    expect(parseTimeEntry('2h on Finanzo review')?.projectHint).toBe('Finanzo')
    expect(parseTimeEntry('2h für Finanzo')?.projectHint).toBe('Finanzo')
    expect(parseTimeEntry('2h @finanzo review')?.projectHint).toBe('finanzo')
    expect(parseTimeEntry('2h #sync-engine tests')?.projectHint).toBe('sync-engine')
  })
  it('LeavesTheRemainderAsTheNote', () => {
    const draft = parseTimeEntry('2h on Finanzo API review gestern')
    expect(draft?.note).toBe('API review')
  })
  it('NoteIsNullWhenNothingIsLeft', () => {
    expect(parseTimeEntry('2h @finanzo')?.note).toBeNull()
  })
})

describe('parseTimeEntry — ticket keys & known projects', () => {
  it('RecognisesAJiraStyleTicketKeyAsTheProjectHint', () => {
    const draft = parseTimeEntry('1,5h PROJ-142 auth bug gestern')
    expect(draft?.projectHint).toBe('PROJ-142')
    expect(draft?.dayOffset).toBe(-1)
    expect(draft?.note).toBe('auth bug')
  })
  it('DoesNotMistakePlainNumbersForTicketKeys', () => {
    expect(parseTimeEntry('2h room 142 cleanup')?.projectHint).toBeNull()
  })
  it('MatchesAKnownProjectNameCaseInsensitivelyAndReturnsCanonicalCasing', () => {
    const draft = parseTimeEntry('2h logo feinschliff', { knownProjects: ['Logo', 'Finanzo'] })
    expect(draft?.projectHint).toBe('Logo')
    expect(draft?.note).toBe('feinschliff')
  })
  it('PrefersAnExplicitSigilOverAKnownProjectName', () => {
    const draft = parseTimeEntry('2h @finanzo logo work', { knownProjects: ['Logo'] })
    expect(draft?.projectHint).toBe('finanzo')
  })
  it('LeavesHintNullWhenNoKnownProjectMatches', () => {
    expect(parseTimeEntry('2h random work', { knownProjects: ['Logo'] })?.projectHint).toBeNull()
  })
})

describe('parseTimeEntry — billable & confidence', () => {
  it('MarksNonBillableOnKeyword', () => {
    expect(parseTimeEntry('1h internal meeting non-billable')?.billable).toBe(false)
    expect(parseTimeEntry('1h Orga nicht abrechenbar')?.billable).toBe(false)
    expect(parseTimeEntry('2h Finanzo')?.billable).toBe(true)
  })
  it('IsMoreConfidentWhenProjectAndDayAreExplicit', () => {
    const rich = parseTimeEntry('2h on Finanzo review yesterday')
    const sparse = parseTimeEntry('2h')
    expect(rich?.confidence).toBeGreaterThan(sparse?.confidence ?? 0)
  })
})
