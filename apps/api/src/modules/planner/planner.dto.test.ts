import { describe, expect, it } from 'vitest'
import { ApplyProposalDto } from './planner.dto.js'

/**
 * The plan-apply wire contract (ADR-0071 P4, REQ-070): the discriminated proposal union must
 * accept each well-formed variant and reject a malformed one loudly — the global
 * `ZodValidationPipe` maps a schema failure to an HTTP 400, so these pin the seam's 400 path
 * without a database.
 */
describe('ApplyProposalDto', () => {
  const schema = ApplyProposalDto.schema

  it('AcceptsEachWellFormedVariant', () => {
    const planId = '3e9a3a3e-7b56-4b2c-9c39-3a2f9adcb111'
    for (const proposal of [
      { kind: 'protect-time', day: '2026-07-21', startMin: 480, endMin: 720 },
      { kind: 'move-block', planId, blockId: '1', toStartMin: 360 },
      { kind: 'shrink-block', planId, blockId: '1', byMin: 30 },
    ]) {
      expect(schema.safeParse({ proposal }).success).toBe(true)
    }
  })

  it('RejectsAnUnknownKind', () => {
    expect(schema.safeParse({ proposal: { kind: 'delete-plan', planId: 'x' } }).success).toBe(false)
  })

  it('RejectsAProtectWindowThatEndsBeforeItStarts', () => {
    expect(
      schema.safeParse({
        proposal: { kind: 'protect-time', day: '2026-07-21', startMin: 720, endMin: 480 },
      }).success,
    ).toBe(false)
  })

  it('RejectsANonUuidPlanIdAndANonPositiveShrink', () => {
    expect(
      schema.safeParse({
        proposal: { kind: 'move-block', planId: 'nope', blockId: '1', toStartMin: 0 },
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({
        proposal: {
          kind: 'shrink-block',
          planId: '3e9a3a3e-7b56-4b2c-9c39-3a2f9adcb111',
          blockId: '1',
          byMin: 0,
        },
      }).success,
    ).toBe(false)
  })
})

describe('ApplyProposalDto — batch kinds (ADR-0072)', () => {
  const schema = ApplyProposalDto.schema
  const planId = '3e9a3a3e-7b56-4b2c-9c39-3a2f9adcb111'
  const placement = { blockId: '1', startMin: 720, lenMin: 60 }
  const block = { startMin: 540, lenMin: 90, kind: 'focus', label: 'Kickoff' }

  it('AcceptsAWellFormedRelayoutAndAddBlocks', () => {
    for (const proposal of [
      { kind: 'relayout-day', planId, placements: [placement], provenance: 'planner-reflow' },
      { kind: 'add-blocks', day: '2026-07-21', blocks: [block], provenance: 'planner-fill' },
      {
        kind: 'add-blocks',
        day: '2026-07-21',
        blocks: [{ ...block, taskId: 't1' }],
        provenance: 'planner-firstrun',
      },
    ]) {
      expect(schema.safeParse({ proposal }).success).toBe(true)
    }
  })

  it('RejectsEmptyPlacementsAndEmptyBlocks', () => {
    expect(
      schema.safeParse({
        proposal: { kind: 'relayout-day', planId, placements: [], provenance: 'planner-reflow' },
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({
        proposal: { kind: 'add-blocks', day: '2026-07-21', blocks: [], provenance: 'planner-fill' },
      }).success,
    ).toBe(false)
  })

  it('RejectsMinutesOutOfBoundsAndLengthsBelowTheFloor', () => {
    for (const bad of [
      { ...placement, startMin: -1 },
      { ...placement, startMin: 1441 },
      { ...placement, lenMin: 14 },
    ]) {
      expect(
        schema.safeParse({
          proposal: {
            kind: 'relayout-day',
            planId,
            placements: [bad],
            provenance: 'planner-reflow',
          },
        }).success,
      ).toBe(false)
    }
    expect(
      schema.safeParse({
        proposal: {
          kind: 'add-blocks',
          day: '2026-07-21',
          blocks: [{ ...block, lenMin: 14 }],
          provenance: 'planner-fill',
        },
      }).success,
    ).toBe(false)
  })

  it('RejectsAForeignProvenance', () => {
    expect(
      schema.safeParse({
        proposal: { kind: 'relayout-day', planId, placements: [placement], provenance: 'sevi' },
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({
        proposal: {
          kind: 'add-blocks',
          day: '2026-07-21',
          blocks: [block],
          provenance: 'planner-reflow',
        },
      }).success,
    ).toBe(false)
  })
})
