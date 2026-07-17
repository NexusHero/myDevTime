import { describe, expect, it } from 'vitest'
import { HOUR_MS, MINUTE_MS } from '../tracking/time.js'
import { parseEntry } from './parse.js'

/**
 * Acceptance for the Smart-Add typed-entry parser (REQ-047, ADR-0065) — Stage 1 of the
 * design-v13 "one plus, one field" quick-add (K6). It classifies a phrase into a typed
 * draft the user confirms as a correctable chip. Pure, de/en, never persists. A weak
 * parse comes back `needsAi: true` so the caller may offer the grounded Stage-2 fallback
 * (ADR-0029) — never a silent guess.
 */
describe('parseEntry — kind detection', () => {
  it('ClassifiesATicketedPhraseAsATask', () => {
    const d = parseEntry('PROJ-142 fix the login redirect')
    expect(d.kind).toBe('task')
    expect(d.ticketKey).toBe('PROJ-142')
    expect(d.projectHint).toBe('PROJ-142')
    expect(d.needsAi).toBe(false)
  })

  it('ClassifiesAClockRangeAsAMeeting_EvenWithoutAKeyword', () => {
    const d = parseEntry('sales 9:00-9:30')
    expect(d.kind).toBe('meeting')
    expect(d.startMin).toBe(9 * 60)
    expect(d.endMin).toBe(9 * 60 + 30)
  })

  it('ClassifiesAKeywordPhraseAsAMeeting', () => {
    expect(parseEntry('standup with the team').kind).toBe('meeting')
    expect(parseEntry('Kickoff Besprechung').kind).toBe('meeting')
  })

  it('ClassifiesAbsenceWordsAsAbsence_NeverBillable', () => {
    const vac = parseEntry('vacation')
    expect(vac.kind).toBe('absence')
    expect(vac.billable).toBe(false)
    expect(parseEntry('krank').kind).toBe('absence')
  })

  it('ClassifiesTravelWordsAsTravel', () => {
    expect(parseEntry('drive to the client site').kind).toBe('travel')
    expect(parseEntry('Bahn nach München').kind).toBe('travel')
  })

  it('ClassifiesPrivateWordsAsPrivate_NeverBillable', () => {
    const doc = parseEntry('doctor appointment')
    expect(doc.kind).toBe('private')
    expect(doc.billable).toBe(false)
    expect(parseEntry('gym 1h').kind).toBe('private')
  })

  it('ClassifiesABareDurationTaskAsATask', () => {
    const d = parseEntry('2h refactor the parser')
    expect(d.kind).toBe('task')
    expect(d.durationMs).toBe(2 * HOUR_MS)
    expect(d.needsAi).toBe(false)
  })

  it('AbsenceOutranksAContainedMeetingWord', () => {
    // "sick" wins over an incidental "call" — absence has top precedence.
    expect(parseEntry('sick, missed the call').kind).toBe('absence')
  })
})

describe('parseEntry — times', () => {
  it('ReadsAClockRangeIntoStartAndEnd', () => {
    const d = parseEntry('review 14:00-15:30')
    expect(d.startMin).toBe(14 * 60)
    expect(d.endMin).toBe(15 * 60 + 30)
    expect(d.durationMs).toBeNull()
  })

  it('ReadsALoneTimeOfDayAsAStart', () => {
    const d = parseEntry('standup at 9:15')
    expect(d.startMin).toBe(9 * 60 + 15)
    expect(d.endMin).toBeNull()
  })

  it('ReadsABareDurationInBothLocales', () => {
    expect(parseEntry('1,5h Finanzo').durationMs).toBe(90 * MINUTE_MS)
    expect(parseEntry('90m review').durationMs).toBe(90 * MINUTE_MS)
    expect(parseEntry('2h 30m task').durationMs).toBe(150 * MINUTE_MS)
  })

  it('RejectsAnOutOfRangeClock', () => {
    expect(parseEntry('at 25:00 nonsense').startMin).toBeNull()
  })
})

describe('parseEntry — day resolution', () => {
  it('ReadsRelativeDays', () => {
    expect(parseEntry('2h Finanzo yesterday').dayOffset).toBe(-1)
    expect(parseEntry('call tomorrow').dayOffset).toBe(1)
    expect(parseEntry('sync today').dayOffset).toBe(0)
  })

  it('EncodesANamedWeekdayAs100PlusIndex', () => {
    // Mon=0 … so Friday → 104, resolved against "today" by the caller.
    expect(parseEntry('vacation friday').dayOffset).toBe(104)
    expect(parseEntry('Urlaub montag').dayOffset).toBe(100)
  })

  it('KeepsARelativeDayAuthoritativeOverAWeekdayWord', () => {
    // "tomorrow" is explicit; a stray weekday token must not override it.
    expect(parseEntry('meeting tomorrow monday recap').dayOffset).toBe(1)
  })
})

describe('parseEntry — project + ticket hints', () => {
  it('PrefersATicketKeyAsTheProjectHint', () => {
    const d = parseEntry('ACME-7 ship it')
    expect(d.ticketKey).toBe('ACME-7')
    expect(d.projectHint).toBe('ACME-7')
  })

  it('ReadsASigilHint', () => {
    const d = parseEntry('review @finanzo 1h')
    expect(d.projectHint).toBe('finanzo')
  })

  it('ResolvesAKnownProjectName', () => {
    const d = parseEntry('2h review the invoices', { knownProjects: ['Finanzo', 'Acme'] })
    // No name present → no hint.
    expect(d.projectHint).toBeNull()
    const hit = parseEntry('2h Finanzo invoices', { knownProjects: ['Finanzo', 'Acme'] })
    expect(hit.projectHint).toBe('Finanzo')
  })
})

describe('parseEntry — title + billable', () => {
  it('StripsConsumedTokensFromTheTitle', () => {
    const d = parseEntry('PROJ-9 fix bug 14:00-15:00 tomorrow')
    expect(d.title).toBe('fix bug')
  })

  it('DefaultsBillableOnAndHonoursANonBillableCue', () => {
    expect(parseEntry('2h Finanzo').billable).toBe(true)
    expect(parseEntry('2h Finanzo non-billable').billable).toBe(false)
    expect(parseEntry('2h Finanzo nicht abrechenbar').billable).toBe(false)
  })
})

describe('parseEntry — AI fallback', () => {
  it('FlagsAVaguePhraseForTheStage2Fallback', () => {
    const d = parseEntry('stuff about the thing')
    expect(d.needsAi).toBe(true)
    expect(d.kind).toBe('task') // best-effort default
    expect(d.confidence).toBeLessThan(0.5)
  })

  it('DoesNotFlagWhenSomethingConcreteAnchorsTheParse', () => {
    expect(parseEntry('meeting at 9:00').needsAi).toBe(false)
    expect(parseEntry('PROJ-1 whatever').needsAi).toBe(false)
    expect(parseEntry('45m unclear thing').needsAi).toBe(false)
  })

  it('AlwaysReturnsADraft', () => {
    // Never null — even an empty phrase yields a fallback draft.
    const d = parseEntry('')
    expect(d.kind).toBe('task')
    expect(d.needsAi).toBe(true)
  })
})
