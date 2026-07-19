import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { AuthModule } from '../auth/auth.module.js'
import { CounterService } from './counter.service.js'
import { ObservabilityController } from './observability.controller.js'
import { RequestMetricsInterceptor } from './observability.interceptor.js'

/**
 * The `observability` module (ADR-0025, REQ-021): the shared `CounterService`, the
 * global request-metrics interceptor that feeds it, and the guarded metrics endpoint.
 * `CounterService` is exported so other modules (e.g. `ai`, recording LLM calls and
 * credit spend) can inject and `increment` it — this module imports none of them, so
 * no dependency cycle is created; the arrow always points INTO observability.
 */
@Module({
  imports: [AuthModule],
  controllers: [ObservabilityController],
  providers: [CounterService, { provide: APP_INTERCEPTOR, useClass: RequestMetricsInterceptor }],
  exports: [CounterService],
})
export class ObservabilityModule {}
