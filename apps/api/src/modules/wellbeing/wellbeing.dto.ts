import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire DTOs for the `wellbeing` module's mood surface (ADR-0071 P3, REQ-068). Zod is the
 * single source (validated by the global `ZodValidationPipe`, fed to OpenAPI via `nestjs-zod`).
 * `mood` is the closed domain vocabulary; `day` is optional — the server fills today (UTC) so
 * the punch-out client needs no clock arithmetic.
 */
const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD day')

export class RecordMoodDto extends createZodDto(
  z.object({
    mood: z.enum(['good', 'tense', 'stressed']),
    day: calendarDay.optional(),
  }),
) {}
