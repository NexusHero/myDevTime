import { describe, expect, it } from 'vitest'
import {
  dryRun,
  evaluate,
  matches,
  orderedRules,
  ruleProvenance,
  type Rule,
  type RuleSubject,
} from './engine.js'

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r1',
  version: 1,
  order: 0,
  matcher: {},
  action: { setProjectId: 'p1' },
  ...over,
})

describe('matches', () => {
  const subject: RuleSubject = {
    note: 'Standup with the team',
    projectId: null,
    source: 'calendar',
    startMin: 9 * 60,
    weekday: 3,
  }

  it('EmptyMatcher_MatchesEverything', () => {
    expect(matches({}, subject)).toBe(true)
  })

  it('NoteContains_IsCaseInsensitive', () => {
    expect(matches({ noteContains: 'STANDUP' }, subject)).toBe(true)
    expect(matches({ noteContains: 'retro' }, subject)).toBe(false)
  })

  it('ProjectIsEmpty_MatchesOnlyUncategorized', () => {
    expect(matches({ projectIsEmpty: true }, subject)).toBe(true)
    expect(matches({ projectIsEmpty: true }, { ...subject, projectId: 'p9' })).toBe(false)
  })

  it('SourceIs_MustEqual', () => {
    expect(matches({ sourceIs: 'calendar' }, subject)).toBe(true)
    expect(matches({ sourceIs: 'manual' }, subject)).toBe(false)
  })

  it('StartWithin_IsHalfOpen', () => {
    expect(matches({ startWithin: { fromMin: 540, toMin: 600 } }, subject)).toBe(true)
    expect(matches({ startWithin: { fromMin: 480, toMin: 540 } }, subject)).toBe(false) // 540 excluded
  })

  it('WeekdayIn_MatchesTheSet', () => {
    expect(matches({ weekdayIn: [1, 3, 5] }, subject)).toBe(true)
    expect(matches({ weekdayIn: [2, 4] }, subject)).toBe(false)
  })

  it('AllConditionsMustHold_AND', () => {
    expect(matches({ noteContains: 'standup', sourceIs: 'calendar' }, subject)).toBe(true)
    expect(matches({ noteContains: 'standup', sourceIs: 'manual' }, subject)).toBe(false)
  })

  it('MissingSubjectField_FailsAConditionThatNeedsIt', () => {
    expect(matches({ startWithin: { fromMin: 0, toMin: 100 } }, {})).toBe(false)
    expect(matches({ weekdayIn: [1] }, {})).toBe(false)
  })
})

describe('ruleProvenance', () => {
  it('IsRuleIdAtVersion', () => {
    expect(ruleProvenance({ id: 'abc', version: 4 })).toBe('rule:abc@4')
  })
})

describe('orderedRules', () => {
  it('SortsByOrderThenId_andDropsDisabled', () => {
    const rules = [
      rule({ id: 'b', order: 1 }),
      rule({ id: 'a', order: 1 }),
      rule({ id: 'c', order: 0 }),
      rule({ id: 'd', order: 0, enabled: false }),
    ]
    expect(orderedRules(rules).map(r => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('evaluate', () => {
  const subject: RuleSubject = { note: 'deploy', projectId: null, source: 'manual' }

  it('FirstMatchWins_orderIsIntent', () => {
    const rules = [
      rule({
        id: 'first',
        order: 0,
        matcher: { noteContains: 'deploy' },
        action: { setProjectId: 'ops' },
      }),
      rule({ id: 'second', order: 1, matcher: {}, action: { setProjectId: 'misc' } }),
    ]
    const m = evaluate(subject, rules)
    expect(m?.ruleId).toBe('first')
    expect(m?.action.setProjectId).toBe('ops')
    expect(m?.provenance).toBe('rule:first@1')
  })

  it('NoMatch_ReturnsNull', () => {
    expect(evaluate(subject, [rule({ matcher: { noteContains: 'xyz' } })])).toBeNull()
  })

  it('DisabledRule_IsSkipped', () => {
    const rules = [
      rule({ id: 'off', order: 0, enabled: false, action: { setProjectId: 'off' } }),
      rule({ id: 'on', order: 1, action: { setProjectId: 'on' } }),
    ]
    expect(evaluate(subject, rules)?.ruleId).toBe('on')
  })
})

describe('dryRun', () => {
  it('PreviewsEverySubject_withoutApplying', () => {
    const rules = [
      rule({ id: 'r', matcher: { noteContains: 'a' }, action: { setBillable: false } }),
    ]
    const rows = dryRun(
      [
        { key: 1, subject: { note: 'alpha' } },
        { key: 2, subject: { note: 'other' } },
      ],
      rules,
    )
    expect(rows[0]?.match?.provenance).toBe('rule:r@1')
    expect(rows[0]?.match?.action.setBillable).toBe(false)
    expect(rows[1]?.match).toBeNull()
  })

  it('EmptyInputs_EmptyPreview', () => {
    expect(dryRun([], [rule()])).toEqual([])
  })
})
