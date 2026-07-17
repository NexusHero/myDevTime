import { describe, expect, it } from 'vitest'
import {
  buildStandup,
  formatHm,
  renderStandupPlain,
  slotsPreserved,
  standupSlots,
  type StandupInput,
} from './standup.js'

const H = 3_600_000
const M = 60_000

const input: StandupInput = {
  date: '2026-07-08',
  yesterday: [
    { label: 'Finanzo', ms: 2 * H },
    { label: 'Meeting', ms: 30 * M },
    { label: 'Empty', ms: 0 },
  ],
  today: [{ label: 'myDevTime', ms: 90 * M }],
  blockers: ['Waiting on API keys', '  '],
}

describe('buildStandup', () => {
  it('NormalizesLines_dropsZero_sortsByDurationDesc', () => {
    const r = buildStandup(input)
    expect(r.yesterday.map(l => l.label)).toEqual(['Finanzo', 'Meeting']) // Empty dropped, sorted
    expect(r.totalYesterdayMs).toBe(2 * H + 30 * M)
    expect(r.totalTodayMs).toBe(90 * M)
  })

  it('KeepsOnlyNonEmptyBlockers', () => {
    expect(buildStandup(input).blockers).toEqual(['Waiting on API keys'])
  })
})

describe('formatHm', () => {
  it('FormatsHoursAndMinutes', () => {
    expect(formatHm(2 * H + 30 * M)).toBe('2h 30m')
    expect(formatHm(2 * H)).toBe('2h')
    expect(formatHm(45 * M)).toBe('45m')
  })
})

describe('standupSlots + slotsPreserved (slot integrity)', () => {
  it('SlotsAreEveryDurationPlusTheTotals', () => {
    const r = buildStandup(input)
    const slots = standupSlots(r)
    expect(slots).toContain('2h') // Finanzo line and yesterday total collapse to one slot
    expect(slots).toContain('30m')
    expect(slots).toContain('1h 30m') // today total + line
    expect(slots).toContain('2h 30m') // yesterday total
  })

  it('AnAiDraftKeepingEveryNumber_passes', () => {
    const r = buildStandup(input)
    const draft =
      'Yesterday I shipped Finanzo (2h) and a Meeting (30m), total 2h 30m; today 1h 30m.'
    expect(slotsPreserved(draft, r)).toBe(true)
  })

  it('AnAiDraftThatChangesANumber_fails', () => {
    const r = buildStandup(input)
    const draft = 'Yesterday I worked 3h total.' // altered the numbers
    expect(slotsPreserved(draft, r)).toBe(false)
  })
})

describe('renderStandupPlain (AI-free degradation)', () => {
  it('RendersTheReportWithSlotNumbers', () => {
    const text = renderStandupPlain(buildStandup(input))
    expect(text).toContain('Standup 2026-07-08')
    expect(text).toContain('Yesterday (2h 30m):')
    expect(text).toContain('- Finanzo (2h)')
    expect(text).toContain('Today (1h 30m):')
    expect(text).toContain('Blockers:')
    expect(text).toContain('- Waiting on API keys')
  })

  it('EmptyDay_ShowsHonestPlaceholders', () => {
    const text = renderStandupPlain(buildStandup({ date: '2026-07-08', yesterday: [], today: [] }))
    expect(text).toContain('- (nothing tracked)')
    expect(text).toContain('- (nothing planned)')
  })
})
