import { describe, expect, it } from 'vitest'
import { initialsOf } from './SessionContext.js'

/**
 * `initialsOf` builds the Profile avatar label from the vendor-free identity:
 * two initials from a full name, a two-letter fallback from a single token or the
 * email, and a safe placeholder when nothing usable is present.
 */
describe('initialsOf', () => {
  it('FullName_TakesFirstOfEachPart', () => {
    expect(initialsOf({ name: 'Suhay Sevinç', email: 'x@y.z' })).toBe('SS')
  })
  it('SingleName_TakesFirstTwoLetters', () => {
    expect(initialsOf({ name: 'Demo', email: 'x@y.z' })).toBe('DE')
  })
  it('NoName_FallsBackToEmail', () => {
    expect(initialsOf({ name: '', email: 'dev@nexushero.io' })).toBe('DE')
  })
  it('Empty_IsPlaceholder', () => {
    expect(initialsOf({ name: '   ', email: '' })).toBe('?')
  })
})
