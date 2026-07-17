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

export class ClockInDto extends createZodDto(
  z.object({ startedAt: wireDate.optional(), source: z.string().min(1).optional() }),
) {}

export class ClockOutDto extends createZodDto(
  z.object({ endedAt: wireDate.optional(), breakMs: z.number().int().nonnegative().optional() }),
) {}

export class ShiftsQueryDto extends createZodDto(z.object({ from: wireDate, to: wireDate })) {}

export class CoverageQueryDto extends createZodDto(z.object({ from: wireDate, to: wireDate })) {}

export class ReportQueryDto extends createZodDto(
  z.object({
    year: z.coerce.number().int().min(1970).max(9999),
    month: z.coerce.number().int().min(1).max(12),
    format: z.enum(['pdf', 'xlsx']).default('pdf'),
    tz: z.string().min(1).default('UTC'),
    locale: z.enum(['en', 'de']).default('en'),
  }),
) {}

/** Monthly work-time statement export (REQ-052, design v13 X). PDF only, one month/page. */
export class StatementQueryDto extends createZodDto(
  z.object({
    year: z.coerce.number().int().min(1970).max(9999),
    month: z.coerce.number().int().min(1).max(12),
    tz: z.string().min(1).default('UTC'),
    locale: z.enum(['en', 'de']).default('en'),
  }),
) {}

export class SetScheduleDto extends createZodDto(
  z.object({
    effectiveFrom: wireDate,
    // Target ms per ISO weekday, Monday first: [Mon…Sun].
    weeklyTargetMs: z.array(z.number().int().nonnegative()).length(7),
  }),
) {}
