import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Wire contract for the Reports/analytics export (REQ-045). The client posts the deterministic
 * dashboard view-model it already holds (the figures came from the deterministic core, ADR-0005) and
 * the server *only formats* it into a PDF — it never recomputes a number, exactly like the timesheet
 * PDF renders `buildTimesheet` (CSV is produced client-side, so it never round-trips the server).
 * Bounds are explicit (SKILL §4 input validation): finite numbers, capped string lengths, and a
 * capped row count so a request can never balloon the render.
 */
const finite = z.number()

const reportExportProject = z.object({
  name: z.string().max(200),
  trackedMs: finite,
})

const reportExportBudget = z.object({
  name: z.string().max(200),
  consumedMinor: finite,
  ratio: finite,
  currencyCode: z.string().min(1).max(8),
})

export const reportExportInput = z.object({
  range: z.string().min(1).max(64),
  totalMs: finite,
  billableMs: finite,
  billableMinor: finite,
  currencyCode: z.string().min(1).max(8),
  overtimeMs: finite,
  projects: z.array(reportExportProject).max(1000),
  budgets: z.array(reportExportBudget).max(1000),
})

export class ReportExportInputDto extends createZodDto(reportExportInput) {}
