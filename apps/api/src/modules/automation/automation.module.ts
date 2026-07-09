import { Module } from '@nestjs/common'
import { AutomationController } from './automation.controller.js'

/** The `automation` module (ADR-0025). */
@Module({ controllers: [AutomationController] })
export class AutomationModule {}
