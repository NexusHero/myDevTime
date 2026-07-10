import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { WorktimeController } from './worktime.controller.js'
import { WorktimeStatusController } from './worktime.status.controller.js'
import { WorktimeContext } from './worktime.context.js'

/**
 * The `worktime` module (REQ-028, ADR-0010/0025): attendance shifts + target-hour
 * schedules and the overtime-balance read. Imports `AuthModule` to consume the
 * exported `AuthGuard`; the shared `WorktimeContext` resolves each caller's
 * workspace over the `DB` token. The deterministic overtime math stays in
 * `packages/domain/attendance`.
 */
@Module({
  imports: [AuthModule],
  controllers: [WorktimeStatusController, WorktimeController],
  providers: [WorktimeContext],
})
export class WorktimeModule {}
