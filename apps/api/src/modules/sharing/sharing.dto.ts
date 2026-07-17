import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire DTOs for the `sharing` module (REQ-064, ADR-0025). Zod is the single source (validated by
 * the global `ZodValidationPipe`, fed to OpenAPI via `nestjs-zod`). The Free/Busy window is given
 * as epoch-ms instants (`from`/`to`); the projection math lives in `packages/domain/sharing`.
 */
export class CreateShareDto extends createZodDto(
  z.object({ label: z.string().trim().min(1).max(80).nullish() }),
) {}

export class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

export class TokenParamDto extends createZodDto(
  // The opaque link secret; base64url, generous bound. Not a UUID.
  z.object({ token: z.string().min(16).max(256) }),
) {}

export class FreeBusyQueryDto extends createZodDto(
  z
    .object({
      from: z.coerce.number().int().nonnegative(),
      to: z.coerce.number().int().nonnegative(),
    })
    .refine(v => v.to > v.from, { message: 'to must be after from', path: ['to'] }),
) {}
