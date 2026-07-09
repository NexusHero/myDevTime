import { Module } from '@nestjs/common'
import { AiController } from './ai.controller.js'

/** The `ai` module (ADR-0025). */
@Module({ controllers: [AiController] })
export class AiModule {}
