import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AiController } from './ai.controller.js'
import { AiContext } from './ai.context.js'
import { NlEntryService } from './nl-entry.service.js'
import { SmartAddService } from './smart-add.service.js'
import { assistantProvider } from './assistant.js'
import { aiInsightsProvider } from './insights.js'
import { standupWriterProvider } from './standup.js'
import { llmProvider } from './llm/llm.provider.js'

/**
 * The `ai` module (ADR-0025/0029): the AI layer's HTTP surface. Binds the
 * configured `LlmPort` (the `NullLlm` default until an adapter is wired), the
 * natural-language entry service (REQ-013) and the grounded assistant (M2);
 * imports `AuthModule` for the guard.
 */
@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    llmProvider,
    NlEntryService,
    SmartAddService,
    AiContext,
    assistantProvider,
    aiInsightsProvider,
    standupWriterProvider,
  ],
})
export class AiModule {}
