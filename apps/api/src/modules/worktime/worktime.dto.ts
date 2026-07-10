import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { wireDate } from '../../core/wire-schemas.js'

/**
 * Wire DTOs for the `worktime` module (REQ-028, ADR-0025). Zod is the single
 * source (validated by the global `ZodValidationPipe`, fed to OpenAPI via
 * `nestjs-zod`); the deterministic overtime math lives in `packages/domain`.
 */
export class WorktimeSummaryQueryDto extends createZodDto(
  z.object({
    from: wireDate,
    to: wireDate,
    tz: z.string().min(1).default('UTC'),
    asOf: wireDate.optional(),
  }),
) {}

export class CreateShiftDto extends createZodDto(
  z.object({
    startedAt: wireDate,
    endedAt: wireDate,
    breakMs: z.number().int().nonnegative().optional(),
    source: z.string().min(1).optional(),
  }),
) {}

export class SetScheduleDto extends createZodDto(
  z.object({
    effectiveFrom: wireDate,
    // Target ms per ISO weekday, Monday first: [Mon…Sun].
    weeklyTargetMs: z.array(z.number().int().nonnegative()).length(7),
  }),
) {}
