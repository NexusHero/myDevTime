import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { WellbeingController } from './wellbeing.controller.js'
import { WellbeingContext } from './wellbeing.context.js'
import { WellbeingService } from './service.js'

/**
 * The `wellbeing` module (ADR-0071 P3, REQ-068): the consented mood surface. Until now the
 * `WellbeingService` was provider-only (the `ai` module binds it for the Evening Companion);
 * this module gives it its own HTTP surface for the mood store. Imports `AuthModule` for the
 * exported `AuthGuard`; `WellbeingContext` resolves each caller's workspace + user over the
 * `DB` token, so the mood memory is workspace-isolated by construction.
 */
@Module({
  imports: [AuthModule],
  controllers: [WellbeingController],
  providers: [WellbeingContext, WellbeingService],
})
export class WellbeingModule {}
