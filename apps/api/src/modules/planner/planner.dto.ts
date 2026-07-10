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
