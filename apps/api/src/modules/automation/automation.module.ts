import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AutomationController } from './automation.controller.js'
import { RulesController } from './rules.controller.js'
import { AutomationContext } from './automation.context.js'

/** The `automation` module (ADR-0025): the deterministic categorization rules engine (REQ-011). */
@Module({
  imports: [AuthModule],
  controllers: [AutomationController, RulesController],
  providers: [AutomationContext],
})
export class AutomationModule {}
