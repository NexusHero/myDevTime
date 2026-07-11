import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { llmProvider } from '../ai/contract.js'
import { PlannerController } from './planner.controller.js'
import { PlannerStatusController } from './planner.status.controller.js'
import { PlannerContext } from './planner.context.js'
import { planLabelerProvider } from './labeler.js'

/**
 * The `planner` module (REQ-031, ADR-0011/0025): the Co-Planner's versioned plan
 * entity + generate/accept endpoints. Imports `AuthModule` to consume the exported
 * `AuthGuard`; the shared `PlannerContext` resolves each caller's workspace over
 * the `DB` token. The deterministic planning algorithm stays in
 * `packages/domain/planner`.
 */
@Module({
  imports: [AuthModule],
  controllers: [PlannerStatusController, PlannerController],
  providers: [PlannerContext, llmProvider, planLabelerProvider],
})
export class PlannerModule {}
