import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AiController } from './ai.controller.js'
import { NlEntryService } from './nl-entry.service.js'
import { llmProvider } from './llm/llm.provider.js'

/**
 * The `ai` module (ADR-0025/0029): the AI layer's HTTP surface. Binds the
 * configured `LlmPort` (the `NullLlm` default until an adapter is wired) and the
 * natural-language entry service (REQ-013); imports `AuthModule` for the guard.
 */
@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [llmProvider, NlEntryService],
})
export class AiModule {}
