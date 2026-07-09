import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'

/** Operational liveness/readiness routes (ADR-0025). */
@Module({ controllers: [HealthController] })
export class HealthModule {}
