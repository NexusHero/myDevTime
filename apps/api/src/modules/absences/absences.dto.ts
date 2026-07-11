import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { HOLIDAY_REGIONS } from '@mydevtime/domain'

const holidayRegion = z.enum(HOLIDAY_REGIONS as unknown as [string, ...string[]])

/**
 * Wire DTOs for the `absences` module (REQ-029, ADR-0025). Zod is the single
 * source (validated by the global `ZodValidationPipe`, fed to OpenAPI via
 * `nestjs-zod`); the deterministic allowance math lives in `packages/domain`.
 * Dates are plain `YYYY-MM-DD` calendar days.
 */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date')

export class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

export class AbsenceRangeQueryDto extends createZodDto(
  z.object({ from: calendarDate, to: calendarDate }),
) {}

export class CreateAbsenceDto extends createZodDto(
  z.object({
    kind: z.enum(['vacation', 'sick', 'holiday', 'other']),
    startDate: calendarDate,
    endDate: calendarDate,
    halfDay: z.boolean().optional(),
    note: z.string().min(1).nullish(),
  }),
) {}

export class SetPolicyDto extends createZodDto(
  z.object({
    annualAllowanceDays: z.number().int().nonnegative(),
    carryOverDays: z.number().int().nonnegative(),
    region: holidayRegion.nullish(),
  }),
) {}

export class BalanceQueryDto extends createZodDto(
  z.object({ year: z.coerce.number().int().min(1970).max(9999) }),
) {}

export class HolidaysQueryDto extends createZodDto(
  z.object({
    region: holidayRegion,
    year: z.coerce.number().int().min(1970).max(9999),
  }),
) {}
