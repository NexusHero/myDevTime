import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../../auth/contract.js'
import { AiContext } from '../ai.context.js'
import { ExportRunDto } from '../ai.dto.js'
import type { ExportItem, ExportTargetPort } from './port.js'
import { listExportRecords, runRecordedExport, type ExportRecordRow } from './ledger.js'
import { EXPORT_TARGET } from './target.provider.js'

/**
 * The dev-tool export API (REQ-035, #44 · ADR-0035): push confirmed insight/action items
 * toward Jira/Linear/Slack through the narrow `ExportTargetPort`, idempotently, with every
 * outcome recorded in the workspace's export ledger. Posting an item IS its confirmation
 * (the client submits only what the user confirmed in the preview). Until a live adapter
 * passes its spike the bound `NullExportTarget` yields honest `unavailable` outcomes —
 * recorded, never half-posted (ADR-0005). Every route resolves the workspace from the
 * authenticated caller, never from the client (ADR-0015).
 */
@ApiTags('ai')
@Controller('api/ai/export')
@UseGuards(AuthGuard)
export class ExportController {
  constructor(
    private readonly ctx: AiContext,
    @Inject(EXPORT_TARGET) private readonly target: ExportTargetPort,
  ) {}

  /** The caller's own export ledger, newest first. */
  @Get('records')
  async records(@CurrentUser() user: AuthenticatedUser): Promise<ExportRecordRow[]> {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    return listExportRecords(db, workspaceId)
  }

  /** Run an export of confirmed items; the ledger keeps re-runs from double-posting. */
  @Post('run')
  async run(@CurrentUser() user: AuthenticatedUser, @Body() body: ExportRunDto) {
    const { db, workspaceId } = await this.ctx.workspaceOf(user)
    // Posting an item is the confirmation act (REQ-035 confirmed-only export); the
    // undefined-key spread keeps the exact-optional `ExportItem` clean.
    const items: ExportItem[] = body.items.map(i => ({
      dedupeKey: i.dedupeKey,
      title: i.label,
      ...(i.payload !== undefined ? { body: i.payload } : {}),
      confirmed: true,
    }))
    const run = await runRecordedExport(db, workspaceId, this.target, body.target, items)
    return { target: body.target, sentCount: run.sentCount, records: run.records }
  }
}
