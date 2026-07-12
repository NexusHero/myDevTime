import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire schemas + DTOs for the `sync` module (REQ-006, ADR-0019/0025). The Zod
 * schemas stay the single source (validated by the global `ZodValidationPipe`,
 * documented via `nestjs-zod` in OpenAPI); the deterministic conflict policy
 * lives in `packages/domain`, untouched.
 */
const syncValue = z.union([z.string(), z.number(), z.boolean(), z.null()])
const entityType = z.enum(['client', 'project', 'task', 'tag', 'timeEntry'])
const entityState = z.object({
  type: entityType,
  id: z.string(),
  deletedAt: z.number().nullable(),
  updatedAt: z.number(),
  deviceId: z.string(),
  fields: z.record(z.string(), syncValue),
})

export const pushBody = z.object({
  changes: z.array(
    z.object({
      type: entityType,
      opId: z.string().min(1),
      base: entityState.nullable(),
      incoming: entityState,
    }),
  ),
})
export const pushResponse = z.object({
  results: z.array(
    z.object({
      opId: z.string(),
      outcome: z.enum(['applied', 'skipped', 'surfaced']),
      version: z.number(),
      state: entityState,
    }),
  ),
})
export const pullQuery = z.object({ since: z.coerce.number().int().nonnegative().default(0) })

// PowerSync CRUD upload (ADR-0043): the client connector uploads its intercepted
// write queue here; the deterministic `resolveCrudWrite` decides apply/surface/noop.
const crudOp = z.enum(['put', 'patch', 'delete'])
export const uploadBody = z.object({
  writes: z.array(
    z.object({
      type: entityType,
      op: crudOp,
      id: z.string().min(1),
      data: z.record(z.string(), syncValue).default({}),
      baseVersion: z.number().int().nonnegative().nullable().default(null),
      updatedAt: z.number(),
      deviceId: z.string(),
    }),
  ),
})
export const uploadResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      type: entityType,
      outcome: z.enum(['applied', 'surfaced', 'noop']),
      version: z.number(),
      fields: z.array(z.string()).optional(),
    }),
  ),
})
export const pullResponse = z.object({
  changes: z.array(z.object({ version: z.number(), state: entityState })),
  watermark: z.number(),
})

export class PushBodyDto extends createZodDto(pushBody) {}
export class PullQueryDto extends createZodDto(pullQuery) {}
export class UploadBodyDto extends createZodDto(uploadBody) {}

export type PushResponse = z.infer<typeof pushResponse>
export type PullResponse = z.infer<typeof pullResponse>
export type UploadResponse = z.infer<typeof uploadResponse>
