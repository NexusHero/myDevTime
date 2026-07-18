import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from './service.js'

/**
 * Unit coverage for the unique-violation detector behind the punch clock's concurrent-clock-in
 * guard (audit M9). Drizzle wraps the pg driver error and hangs the original on `.cause`, so the
 * SQLSTATE `23505` is nested — the detector must walk the cause chain, or the race loser leaks a
 * raw 500 instead of the clean `ValidationError` (a Postgres-only flake that this pins down).
 */
describe('isUniqueViolation', () => {
  it('DetectsATopLevelUniqueViolation', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  it('DetectsAUniqueViolationNestedUnderCause_theDrizzleShape', () => {
    // DrizzleQueryError wraps the pg error: { message, cause: { code: '23505', ... } }.
    const wrapped = {
      message: 'Failed query: insert into "attendance_shifts" …',
      cause: { code: '23505' },
    }
    expect(isUniqueViolation(wrapped)).toBe(true)
  })

  it('DetectsAUniqueViolationSeveralCausesDeep', () => {
    expect(isUniqueViolation({ cause: { cause: { code: '23505' } } })).toBe(true)
  })

  it('IgnoresUnrelatedErrors', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false) // foreign-key violation
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation('nope')).toBe(false)
  })

  it('IsBoundedAgainstACauseCycle', () => {
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(isUniqueViolation(cyclic)).toBe(false) // terminates, no infinite loop
  })
})
