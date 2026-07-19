import { Body, Controller, Post, Query, Res, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { reportToCsv } from '@mydevtime/domain'
import { AuthGuard } from '../auth/contract.js'
import { reportToPdf } from './export/reports-pdf.js'
import { ReportExportInputDto, ReportExportQueryDto } from './reports-export.dto.js'

/**
 * Reports/analytics export route (REQ-045), a sibling of `GET /api/tracking/summary`. The Reports
 * dashboard aggregates its view-model client-side across the tracking, billing and budget modules;
 * this endpoint takes that deterministic view-model and returns it as a downloadable **CSV or PDF**.
 * The server *only formats* — every figure is already the deterministic core's and is never
 * recomputed here (ADR-0005), exactly like the timesheet PDF renders `buildTimesheet`. Read-only:
 * nothing is persisted. Behind `AuthGuard` — the payload is the caller's own dashboard figures.
 * Distinct from the timesheet/invoice export (`/api/billing/.../export`, REQ-009), which renders
 * billable line items for signing.
 */
@ApiTags('tracking')
@Controller('api/tracking/reports')
@UseGuards(AuthGuard)
export class ReportsExportController {
  @Post('export')
  async export(
    @Query() query: ReportExportQueryDto,
    @Body() body: ReportExportInputDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const base = `mydevtime-reports-${body.range}`.replace(/[^\w.-]+/g, '_')
    // This endpoint reflects the caller's own dashboard view-model back as a file. Force a
    // download and forbid MIME-sniffing so a browser can never re-interpret the reflected content
    // as HTML in our origin (defence-in-depth against reflected XSS on a non-HTML download).
    if (query.format === 'pdf') {
      const buffer = await reportToPdf(body)
      await reply
        .header('content-disposition', `attachment; filename="${base}.pdf"`)
        .header('x-content-type-options', 'nosniff')
        .type('application/pdf')
        .send(buffer)
      return
    }
    await reply
      .header('content-disposition', `attachment; filename="${base}.csv"`)
      .header('x-content-type-options', 'nosniff')
      .type('text/csv; charset=utf-8')
      .send(reportToCsv(body))
  }
}
