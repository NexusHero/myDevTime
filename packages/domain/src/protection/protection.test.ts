import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../tracking/time.js'
import {
  buildDigest,
  isProtectedAt,
  partitionByProtection,
  transitionPromptDue,
  type HeldItem,
  type ProtectedBlock,
} from './protection.js'

/**
 * Acceptance for the protection-flag core (REQ-057, design v14 D14). The 🛡 flag on an
 * existing entry governs **communication only, never time-tracking**: while a protected
 * block is active the user's own nudges are held, and afterwards they surface as **exactly
 * one** digest — nothing is lost. At a protected block that starts while punched in the
 * Island asks **once**; it never auto-punches-out. Pure and deterministic (ADR-0005).
 */
const T0 = 18 * HOUR_MS // 18:00 today, epoch-agnostic (arithmetic only)
const family: ProtectedBlock = { startMs: T0, endMs: T0 + 3 * HOUR_MS } // 18:00–21:00

const held = (kind: HeldItem['kind'], atMs: number): HeldItem => ({ kind, atMs })

describe('isProtectedAt', () => {
  it('IsTrueInsideAProtectedBlock_HalfOpenAtTheEnd', () => {
    expect(isProtectedAt(T0, [family])).toBe(true)
    expect(isProtectedAt(T0 + HOUR_MS, [family])).toBe(true)
    expect(isProtectedAt(T0 + 3 * HOUR_MS, [family])).toBe(false) // end is exclusive
  })

  it('IsFalseOutsideEveryBlock', () => {
    expect(isProtectedAt(T0 - HOUR_MS, [family])).toBe(false)
    expect(isProtectedAt(T0, [])).toBe(false)
  })
})

describe('partitionByProtection', () => {
  it('HoldsNotificationsDuringProtection_DeliversTheRest', () => {
    const notes: HeldItem[] = [
      held('timer_nudge', T0 + HOUR_MS), // during → held
      held('meeting_request', T0 + 2 * HOUR_MS), // during → held
      held('task_reminder', T0 - HOUR_MS), // before → delivered
    ]
    const { heldItems, delivered } = partitionByProtection(notes, [family])
    expect(heldItems.map(i => i.kind)).toEqual(['timer_nudge', 'meeting_request'])
    expect(delivered.map(i => i.kind)).toEqual(['task_reminder'])
  })

  it('DeliversEverythingWhenNothingIsProtected', () => {
    const notes = [held('drift_chip', T0), held('timer_nudge', T0 + HOUR_MS)]
    const { heldItems, delivered } = partitionByProtection(notes, [])
    expect(heldItems).toEqual([])
    expect(delivered).toHaveLength(2)
  })
})

describe('buildDigest — exactly one digest, nothing lost', () => {
  it('AggregatesAllHeldItemsIntoOneDigestWithPerKindCounts', () => {
    const digest = buildDigest([
      held('meeting_request', T0 + HOUR_MS),
      held('meeting_request', T0 + 2 * HOUR_MS),
      held('task_reminder', T0 + HOUR_MS),
    ])
    expect(digest.total).toBe(3)
    expect(digest.counts.meeting_request).toBe(2)
    expect(digest.counts.task_reminder).toBe(1)
    expect(digest.items).toHaveLength(3)
  })

  it('IsEmptyButValidWhenNothingWasHeld', () => {
    const digest = buildDigest([])
    expect(digest.total).toBe(0)
    expect(digest.items).toEqual([])
    expect(digest.counts).toEqual({})
  })
})

describe('transitionPromptDue — ask once, never auto-punch-out', () => {
  it('IsDueOnlyWhenPunchedInAndNotYetPrompted', () => {
    expect(transitionPromptDue({ punchedIn: true, alreadyPrompted: false })).toBe(true)
  })

  it('IsSilentWhenAlreadyPrompted', () => {
    expect(transitionPromptDue({ punchedIn: true, alreadyPrompted: true })).toBe(false)
  })

  it('IsSilentWhenNotPunchedIn', () => {
    // Protected + punched-out is the normal case: nothing to ask.
    expect(transitionPromptDue({ punchedIn: false, alreadyPrompted: false })).toBe(false)
  })
})
