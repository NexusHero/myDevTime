import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { CatalogController } from './catalog.controller.js'
import { EntriesController } from './entries.controller.js'
import { SummaryController } from './summary.controller.js'
import { TrackingStatusController } from './tracking.controller.js'
import { TrackingContext } from './tracking.context.js'

/**
 * The `tracking` module (REQ-001/004, ADR-0003/0015/0025): catalog CRUD + time
 * entries. Imports `AuthModule` to consume the exported `AuthGuard`; the shared
 * `TrackingContext` resolves each caller's workspace over the `DB` token. The
 * deterministic tracking logic stays in `packages/domain`.
 */
@Module({
  imports: [AuthModule],
  controllers: [TrackingStatusController, CatalogController, EntriesController, SummaryController],
  providers: [TrackingContext],
})
export class TrackingModule {}
