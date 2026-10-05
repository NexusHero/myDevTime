// Property-based fuzzing of the free-text entry parser (ADR-0078 #7).
//
// `parseTimeEntry` reads text a user (or anything pasting into the Smart-Add field)
// typed, and its duration can end up on a timesheet once confirmed (ADR-0005). The
// example-based tests in parse.test.ts pin the phrases we thought of; these
// properties must hold for *every* input fast-check can generate, including the
// hostile ones: regex metacharacters, huge digit runs, mixed scripts, control chars.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import { parseTimeEntry } from './parse.js'

/** Any text, biased towards the tokens the parser actually reacts to. */
const phrase = fc
  .array(
    fc.oneof(
      fc.string({ unit: 'grapheme' }),
      fc.constantFrom('h', 'std', 'min', 'm', ':', '.', ',', '@', '#', '-', '–', 'um ', 'at '),
      fc.constantFrom('yesterday', 'gestern', 'heute', 'today', 'billable', 'abrechenbar'),
      fc.integer({ min: 0, max: 99_999 }).map(String),
      fc.constantFrom('PROJ-142', '(.*)+', '[a-z', '\\', '$&', '\u0000', '‮'),
    ),
    { maxLength: 40 },
  )
  .map(parts => parts.join(' '))

/** Catalog names chosen to break a parser that builds regexes from them unescaped. */
const knownProjects = fc.array(
  fc.oneof(fc.string(), fc.constantFrom('(a+)+', '[', '.*', 'C++', 'a|b', '\\d', '?')),
  { maxLength: 8 },
)

describe('parseTimeEntry — properties over arbitrary input', () => {
  it('never throws, whatever the text or the catalog', () => {
    fc.assert(
      fc.property(phrase, knownProjects, (text, projects) => {
        parseTimeEntry(text, { knownProjects: projects })
      }),
      { numRuns: 2_000 },
    )
  })

  it('is deterministic: the same input always yields the same draft', () => {
    fc.assert(
      fc.property(phrase, knownProjects, (text, projects) => {
        expect(parseTimeEntry(text, { knownProjects: projects })).toEqual(
          parseTimeEntry(text, { knownProjects: projects }),
        )
      }),
    )
  })

  it('returns null or a well-formed draft: finite positive duration, integer day, confidence in [0, 1]', () => {
    fc.assert(
      fc.property(phrase, knownProjects, (text, projects) => {
        const draft = parseTimeEntry(text, { knownProjects: projects })
        if (draft === null) return
        expect(Number.isFinite(draft.durationMs)).toBe(true)
        expect(draft.durationMs).toBeGreaterThan(0)
        expect(Number.isInteger(draft.dayOffset)).toBe(true)
        expect(draft.confidence).toBeGreaterThanOrEqual(0)
        expect(draft.confidence).toBeLessThanOrEqual(1)
      }),
      { numRuns: 2_000 },
    )
  })

  it('reads a bare "<n>h" as exactly n hours', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 24 }), n => {
        expect(parseTimeEntry(`${String(n)}h`)?.durationMs).toBe(n * HOUR_MS)
      }),
    )
  })

  it('stays fast on long hostile input (no catastrophic regex backtracking)', () => {
    const hostile = [
      '1'.repeat(50_000),
      '1.'.repeat(25_000),
      '1:'.repeat(25_000),
      `${'9'.repeat(4)} `.repeat(10_000),
      '@ '.repeat(25_000),
      'um 1'.repeat(12_000),
    ]
    for (const text of hostile) {
      const started = Date.now()
      parseTimeEntry(text, { knownProjects: ['(a+)+', 'PROJ'] })
      expect(Date.now() - started).toBeLessThan(500)
    }
  })
})
