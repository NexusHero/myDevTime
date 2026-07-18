import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * DTOs for the GDPR privacy API (REQ-020). Account erasure is irreversible, so the request
 * body must carry the exact confirmation literal — a client bug (or a replayed generic DELETE)
 * can never wipe an account by accident. The retention purge window is bounded to sane values
 * (1 day … 10 years) and defaults to 90 days.
 */

export class EraseAccountDto extends createZodDto(
  z.object({
    confirm: z.literal('DELETE'),
  }),
) {}

export class PurgeRetentionDto extends createZodDto(
  z.object({
    olderThanDays: z.number().int().min(1).max(3650).default(90),
  }),
) {}
