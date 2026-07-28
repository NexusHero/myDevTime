import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire DTOs for the `recurrence` module (REQ-060, ADR-0025). Zod is the single source (validated
 * by the global `ZodValidationPipe`, fed to OpenAPI via `nestjs-zod`); the occurrence math lives
 * in `packages/domain`. Dates are plain `YYYY-MM-DD` calendar days; times are minute-of-day.
 */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date')

/** One invited person on a meeting series (REQ-075). Only the name is required — a connector
 *  that supplies no address or no response status must not force us to invent either. */
const attendee = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(320).optional(),
  response: z.enum(['accepted', 'tentative', 'declined', 'needsAction']).optional(),
})

export class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

export class OccurrencesQueryDto extends createZodDto(
  z.object({ from: calendarDate, to: calendarDate }),
) {}

export class CreateSeriesDto extends createZodDto(
  z
    .object({
      kind: z.enum(['meeting', 'focus', 'break', 'life', 'travel']),
      title: z.string().trim().min(1).max(200),
      anchorDate: calendarDate,
      startMin: z.number().int().min(0).max(1439),
      lenMin: z.number().int().min(1).max(1440),
      // A series always repeats — 'none' is not a series.
      freq: z.enum(['daily', 'weekly', 'monthly']),
      endKind: z.enum(['never', 'until', 'count']).default('never'),
      untilDate: calendarDate.nullish(),
      count: z.number().int().min(1).max(1000).nullish(),
      projectId: z.uuid().nullish(),
      // Optional planning metadata for a hand-created entry (design v19 New-Entry dialog).
      priority: z.number().int().min(1).max(3).nullish(),
      note: z.string().trim().max(500).nullish(),
      // Meeting detail (REQ-075, issue #375). Attendee records are third-party personal data:
      // bounded in size, and never served by the Free/Busy share path (REQ-064).
      location: z.string().trim().max(200).nullish(),
      attendees: z.array(attendee).max(200).nullish(),
      conferenceUrl: z.url().max(2000).nullish(),
      conferenceProvider: z.string().trim().max(60).nullish(),
    })
    .refine(v => v.endKind !== 'until' || typeof v.untilDate === 'string', {
      message: 'untilDate is required when endKind is "until"',
      path: ['untilDate'],
    })
    .refine(v => v.endKind !== 'count' || typeof v.count === 'number', {
      message: 'count is required when endKind is "count"',
      path: ['count'],
    }),
) {}

export class TruncateSeriesDto extends createZodDto(z.object({ at: calendarDate })) {}
