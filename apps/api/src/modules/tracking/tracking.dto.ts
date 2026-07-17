import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { wireDate } from '../../core/wire-schemas.js'
import { idParam, listQuery, name } from './schemas.js'

/**
 * Wire DTOs for the `tracking` module (REQ-001/004, ADR-0025). Each request
 * body/query/param is a Zod schema wrapped by `createZodDto`, validated by the
 * global `ZodValidationPipe`; response shapes stay in `schemas.ts`. The Zod
 * schemas remain the single source (also feeding OpenAPI via `nestjs-zod`).
 */

// ── Params & shared queries ───────────────────────────────────────────────
export class IdParamDto extends createZodDto(idParam) {}
export class ListQueryDto extends createZodDto(listQuery) {}

// ── Clients ───────────────────────────────────────────────────────────────
export class CreateClientDto extends createZodDto(z.object({ name })) {}
export class UpdateClientDto extends createZodDto(
  z.object({ name: name.optional(), archived: z.boolean().optional() }),
) {}

// ── Projects ──────────────────────────────────────────────────────────────
const projectBody = {
  clientId: z.uuid().nullish(),
  color: z.string().nullish(),
  billableDefault: z.boolean().optional(),
  // Fixed-fee / expected revenue in minor units (design v17 §K4); null clears it.
  fixedFeeMinor: z.number().int().nonnegative().nullish(),
}
export class CreateProjectDto extends createZodDto(z.object({ name, ...projectBody })) {}
export class UpdateProjectDto extends createZodDto(
  z.object({ name: name.optional(), ...projectBody, archived: z.boolean().optional() }),
) {}

// ── Tasks ─────────────────────────────────────────────────────────────────
export class CreateTaskDto extends createZodDto(
  z.object({ name, projectId: z.uuid(), billableDefault: z.boolean().optional() }),
) {}
export class UpdateTaskDto extends createZodDto(
  z.object({
    name: name.optional(),
    billableDefault: z.boolean().optional(),
    archived: z.boolean().optional(),
  }),
) {}

// ── Tags ──────────────────────────────────────────────────────────────────
export class CreateTagDto extends createZodDto(z.object({ name, color: z.string().nullish() })) {}
export class UpdateTagDto extends createZodDto(
  z.object({
    name: name.optional(),
    color: z.string().nullish(),
    archived: z.boolean().optional(),
  }),
) {}

// ── Time entries ──────────────────────────────────────────────────────────
export class StartTimerDto extends createZodDto(
  z.object({
    projectId: z.uuid().nullish(),
    taskId: z.uuid().nullish(),
    billable: z.boolean().optional(),
    note: z.string().nullish(),
    startedAt: wireDate.optional(),
  }),
) {}
export class StopTimerDto extends createZodDto(z.object({ endedAt: wireDate.optional() })) {}
export class CreateEntryDto extends createZodDto(
  z.object({
    startedAt: wireDate,
    endedAt: wireDate,
    projectId: z.uuid().nullish(),
    taskId: z.uuid().nullish(),
    billable: z.boolean().optional(),
    note: z.string().nullish(),
  }),
) {}
export class ListEntriesQueryDto extends createZodDto(
  z.object({
    from: wireDate.optional(),
    to: wireDate.optional(),
    /** Free-text note search (REQ-036): case-insensitive substring over the entry note. */
    q: z.string().trim().min(1).max(200).optional(),
  }),
) {}
export class SummaryQueryDto extends createZodDto(
  z.object({ from: wireDate, to: wireDate, tz: z.string().min(1).default('UTC') }),
) {}
export class UpdateEntryDto extends createZodDto(
  z.object({
    startedAt: wireDate.optional(),
    endedAt: wireDate.nullish(),
    projectId: z.uuid().nullish(),
    taskId: z.uuid().nullish(),
    billable: z.boolean().optional(),
    note: z.string().nullish(),
  }),
) {}
export class SplitEntryDto extends createZodDto(z.object({ at: wireDate })) {}
