import { z } from 'zod'

/**
 * Shared response/request schemas for the tracking routes. Kept in one place so
 * the catalog and entry route modules stay focused on wiring, not shape
 * definitions, and the OpenAPI document stays consistent across both.
 */

const timestamps = { createdAt: z.date(), updatedAt: z.date() }

export const clientSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  archived: z.boolean(),
  ...timestamps,
})

export const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  clientId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  billableDefault: z.boolean(),
  hourlyRateOverride: z.string().nullable(),
  archived: z.boolean(),
  ...timestamps,
})

export const taskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  name: z.string(),
  billableDefault: z.boolean(),
  // Effort estimation (REQ-041) — nullable: a task without an estimate is the honest default.
  category: z.string().nullable(),
  complexity: z.string().nullable(),
  estimateMinutes: z.number().int().nullable(),
  archived: z.boolean(),
  ...timestamps,
})

export const tagSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  archived: z.boolean(),
  ...timestamps,
})

export const entrySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  billable: z.boolean(),
  source: z.string(),
  note: z.string().nullable(),
  ...timestamps,
})

export const idParam = z.object({ id: z.uuid() })
export const listQuery = z.object({ includeArchived: z.coerce.boolean().default(false) })
export const name = z.string().min(1).max(200)
