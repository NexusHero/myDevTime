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
