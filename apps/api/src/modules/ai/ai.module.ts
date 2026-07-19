import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AiController } from './ai.controller.js'
import { AiContext } from './ai.context.js'
import { NlEntryService } from './nl-entry.service.js'
import { SmartAddService } from './smart-add.service.js'
import { assistantProvider } from './assistant.js'
import { aiInsightsProvider } from './insights.js'
import { standupWriterProvider } from './standup.js'
import { categorizerProvider } from './categorize.js'
import { estimatorProvider } from './estimate.js'
import { meetingInsightsProvider } from './meeting-insights.js'
import { companionProvider } from './companion.js'
import { WellbeingService } from '../wellbeing/service.js'
import { llmProvider } from './llm/llm.provider.js'
import { ExportController } from './export/export.controller.js'
import { exportTargetProvider } from './export/target.provider.js'

/**
 * The `ai` module (ADR-0025/0029): the AI layer's HTTP surface. Binds the
 * configured `LlmPort` (the `NullLlm` default until an adapter is wired), the
 * natural-language entry service (REQ-013), the grounded assistant (M2), the
 * categorization proposals (REQ-012) and the dev-tool export ledger (REQ-035,
 * `NullExportTarget` until a live adapter passes its spike); imports
 * `AuthModule` for the guard.
 */
@Module({
  imports: [AuthModule],
  controllers: [AiController, ExportController],
  providers: [
    llmProvider,
    NlEntryService,
    SmartAddService,
    AiContext,
    assistantProvider,
    aiInsightsProvider,
    standupWriterProvider,
    categorizerProvider,
    estimatorProvider,
    meetingInsightsProvider,
    companionProvider,
    WellbeingService,
    exportTargetProvider,
  ],
})
export class AiModule {}
