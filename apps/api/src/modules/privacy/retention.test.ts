import { describe, expect, it } from 'vitest'
import { retentionCutoff } from './service.js'

/**
 * The pure retention arithmetic (REQ-020, ADR-0005): the cutoff is exactly
 * `days × 24h` before `now` — deterministic, timezone-free, no mutation.
 */
describe('retentionCutoff', () => {
  it('RetentionCutoff_90Days_IsExactly90Times24hEarlier', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    expect(retentionCutoff(now, 90).toISOString()).toBe('2026-04-19T12:00:00.000Z')
  })

  it('RetentionCutoff_OneDay_IsExactly24hEarlier', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(retentionCutoff(now, 1).toISOString()).toBe('2025-12-31T00:00:00.000Z')
  })

  it('RetentionCutoff_AcrossDstBoundary_StaysPure24hArithmetic', () => {
    // 2026-03-29 is the EU DST switch — a calendar-based cutoff would drift an
    // hour; the pure 24h arithmetic must not.
    const now = new Date('2026-03-30T08:00:00.000Z')
    expect(retentionCutoff(now, 2).toISOString()).toBe('2026-03-28T08:00:00.000Z')
  })

  it('RetentionCutoff_Always_LeavesTheInputUntouched', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    const before = now.getTime()
    retentionCutoff(now, 3650)
    expect(now.getTime()).toBe(before)
  })

  it('RetentionCutoff_SameInputs_IsDeterministic', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    expect(retentionCutoff(now, 30).getTime()).toBe(retentionCutoff(now, 30).getTime())
  })
})
