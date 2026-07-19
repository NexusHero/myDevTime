import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/** Path param: a connector id (validated against the registry in the controller). */
export class ConnectorIdParamDto extends createZodDto(
  z.object({ id: z.string().min(1).max(40) }),
) {}

/** Optional listing state: `open` (default) or `all` (open + closed). */
export class IssuePreviewQueryDto extends createZodDto(
  z.object({ state: z.enum(['open', 'all']).optional() }),
) {}
