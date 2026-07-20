import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire DTOs for the `planner` module (REQ-031, ADR-0025). Zod is the single source
 * (validated by the global `ZodValidationPipe`, fed to OpenAPI via `nestjs-zod`);
 * the deterministic planning algorithm lives in `packages/domain`.
 */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date')

const anchor = z.object({
  startMin: z.number().int().nonnegative(),
  lenMin: z.number().int().positive(),
  label: z.string().min(1),
})
const candidate = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  estimateMin: z.number().int().nonnegative(),
  priority: z.number().int(),
})

export class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

export class PlanDateQueryDto extends createZodDto(z.object({ date: calendarDate })) {}

export class GeneratePlanDto extends createZodDto(
  z.object({
    date: calendarDate,
    dayStartMin: z.number().int().nonnegative(),
    dayEndMin: z.number().int().positive(),
    anchors: z.array(anchor).default([]),
    backlog: z.array(candidate).default([]),
    breakAfterMin: z.number().int().positive().optional(),
    breakLenMin: z.number().int().positive().optional(),
    minBlockMin: z.number().int().positive().optional(),
  }),
) {}

export class PlanStatusDto extends createZodDto(
  z.object({ status: z.enum(['proposed', 'accepted', 'dismissed']) }),
) {}

/**
 * The plan-apply seam's wire shape (ADR-0071 P4, REQ-070): a *confirmed* Sevi proposal the
 * user accepted. `protect-time` books a durable 🛡 window (`protected_times`); `move-block` /
 * `shrink-block` mutate a stored plan's blocks purely (domain `applyProposal`) into a NEW
 * accepted plan version. The client mirrors this exact union.
 */
export type PlanProposal =
  | { kind: 'protect-time'; day: string; startMin: number; endMin: number }
  | { kind: 'move-block'; planId: string; blockId: string; toStartMin: number }
  | { kind: 'shrink-block'; planId: string; blockId: string; byMin: number }

const minuteOfDay = z.number().int().min(0).max(1440)

const planProposalSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('protect-time'),
      day: calendarDate,
      startMin: minuteOfDay,
      endMin: minuteOfDay,
    })
    .refine(p => p.endMin > p.startMin, { message: 'endMin must be after startMin' }),
  z.object({
    kind: z.literal('move-block'),
    planId: z.uuid(),
    blockId: z.string().min(1),
    toStartMin: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('shrink-block'),
    planId: z.uuid(),
    blockId: z.string().min(1),
    byMin: z.number().int().positive(),
  }),
])

export class ApplyProposalDto extends createZodDto(z.object({ proposal: planProposalSchema })) {}

export class ProtectedDayQueryDto extends createZodDto(z.object({ day: calendarDate })) {}
