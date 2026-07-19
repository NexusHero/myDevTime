import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { AuthGuard } from '../auth/contract.js'
import { reportToPdf } from './export/reports-pdf.js'
import { ReportExportInputDto } from './reports-export.dto.js'

/**
 * Reports/analytics export route (REQ-045), a sibling of `GET /api/tracking/summary`. The Reports
 * dashboard aggregates its view-model client-side across the tracking, billing and budget modules;
 * this endpoint renders that deterministic view-model as a downloadable **PDF**. The server *only
 * formats* — every figure is already the deterministic core's and is never recomputed here
 * (ADR-0005), exactly like the timesheet PDF renders `buildTimesheet`. Read-only: nothing is
 * persisted. Behind `AuthGuard` — the payload is the caller's own dashboard figures.
 *
 * CSV is produced entirely client-side (`reports/exportCsv`, the same deterministic `reportToCsv`
 * core) and never round-trips through the server — so this route only renders the PDF, whose bytes
 * are a binary buffer, never the reflected request string. Distinct from the timesheet/invoice
 * export (`/api/billing/.../export`, REQ-009), which renders billable line items for signing.
 */
@ApiTags('tracking')
@Controller('api/tracking/reports')
@UseGuards(AuthGuard)
export class ReportsExportController {
  @Post('export')
  async export(@Body() body: ReportExportInputDto, @Res() reply: FastifyReply): Promise<void> {
    const base = `mydevtime-reports-${body.range}`.replace(/[^\w.-]+/g, '_')
    const buffer = await reportToPdf(body)
    // Force a download and forbid MIME-sniffing so a browser can never interpret the rendered
    // PDF as anything else in our origin (defence-in-depth on a reflected-view-model download).
    await reply
      .header('content-disposition', `attachment; filename="${base}.pdf"`)
      .header('x-content-type-options', 'nosniff')
      .type('application/pdf')
      .send(buffer)
  }
}
