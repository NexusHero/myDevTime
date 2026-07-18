import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/** Path param: a connector id (validated against the registry in the service). */
export class ConnectorIdParamDto extends createZodDto(
  z.object({ id: z.string().min(1).max(40) }),
) {}

/** Consent patch (M3, ADR-0033): one capability's opt-in for a connector. */
export class ConsentDto extends createZodDto(
  z.object({
    capability: z.enum(['inbound', 'outbound', 'capture']),
    granted: z.boolean(),
  }),
) {}

/**
 * The provider's OAuth callback query (RFC 6749 §4.1.2): `code` + our signed
 * `state` on success, `error` when the user denied or the provider refused.
 */
export class OAuthCallbackQueryDto extends createZodDto(
  z.object({
    code: z.string().min(1).optional(),
    state: z.string().min(1),
    error: z.string().optional(),
  }),
) {}

/** Optional preview window (ms epoch); defaults are applied in the controller. */
export class CalendarPreviewQueryDto extends createZodDto(
  z.object({
    fromMs: z.coerce.number().int().optional(),
    toMs: z.coerce.number().int().optional(),
  }),
) {}
