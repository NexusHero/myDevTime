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

/**
 * Record already-imported tickets (REQ-066): one link per ticket the client created a task for.
 * `taskId` is optional — the link is what dedups the next preview; the task was created by the
 * tracking endpoint (ADR-0005: this writes link rows only, never tasks).
 */
export class RecordImportedBodyDto extends createZodDto(
  z.object({
    items: z
      .array(
        z.object({
          externalKey: z.string().min(1).max(200),
          taskId: z.uuid().optional(),
        }),
      )
      .max(500),
  }),
) {}
