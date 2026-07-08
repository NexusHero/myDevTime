import { describe, expect, it } from 'vitest'
import { canCreateChild, isValidName, normalizeName } from './validation.js'

describe('normalizeName', () => {
  it('NormalizeName_Whitespace_Trims', () => {
    expect(normalizeName('  Acme  ')).toBe('Acme')
  })
})

describe('isValidName', () => {
  it('IsValidName_NonEmptyWithinLimit_True', () => {
    expect(isValidName('Acme')).toBe(true)
    expect(isValidName('  x  ')).toBe(true)
  })

  it('IsValidName_EmptyOrWhitespace_False', () => {
    expect(isValidName('')).toBe(false)
    expect(isValidName('   ')).toBe(false)
  })

  it('IsValidName_TooLong_False', () => {
    expect(isValidName('a'.repeat(201))).toBe(false)
    expect(isValidName('a'.repeat(200))).toBe(true)
  })
})

describe('canCreateChild', () => {
  it('CanCreateChild_ActiveParent_True', () => {
    expect(canCreateChild({ archived: false })).toBe(true)
  })

  it('CanCreateChild_ArchivedParent_False', () => {
    expect(canCreateChild({ archived: true })).toBe(false)
  })
})
