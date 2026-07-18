import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * DTOs for the categorization rules API (REQ-011). The matcher/action shapes mirror the
 * deterministic `RuleMatcher`/`RuleAction` in `packages/domain` exactly, validated here so a
 * malformed rule can never reach the engine or the JSON columns (ADR-0005).
 */
const matcher = z.object({
  noteContains: z.string().optional(),
  sourceIs: z.string().optional(),
  projectIsEmpty: z.boolean().optional(),
  startWithin: z.object({ fromMin: z.number().int(), toMin: z.number().int() }).optional(),
  weekdayIn: z.array(z.number().int().min(1).max(7)).optional(),
})

const action = z.object({
  setProjectId: z.string().optional(),
  setTaskId: z.string().optional(),
  addTags: z.array(z.string()).optional(),
  setBillable: z.boolean().optional(),
})

export class CreateRuleDto extends createZodDto(
  z.object({
    order: z.number().int().optional(),
    matcher: matcher.optional(),
    action: action.optional(),
    enabled: z.boolean().optional(),
  }),
) {}

export class UpdateRuleDto extends createZodDto(
  z.object({
    order: z.number().int().optional(),
    matcher: matcher.optional(),
    action: action.optional(),
    enabled: z.boolean().optional(),
  }),
) {}

const subject = z.object({
  note: z.string().optional(),
  projectId: z.string().nullable().optional(),
  source: z.string().optional(),
  startMin: z.number().int().optional(),
  weekday: z.number().int().min(1).max(7).optional(),
})

export class DryRunRulesDto extends createZodDto(
  z.object({
    subjects: z.array(z.object({ key: z.string(), subject })),
  }),
) {}
