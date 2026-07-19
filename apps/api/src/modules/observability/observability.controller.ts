import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard } from '../auth/contract.js'
import { CounterService } from './counter.service.js'
import { buildSnapshot, type MetricsSnapshot } from './metrics.js'

/**
 * Operational observability (REQ-021): a JSON snapshot of the in-process counters —
 * request totals by status class, the AI call/credit-spend tallies, and process
 * uptime. Guarded by `AuthGuard` like every other data route (ADR-0025): these are
 * internal operational signals, not a public scrape target. The numbers here are
 * operational only — no timesheet/budget/invoice value is ever computed from them
 * (those stay in `packages/domain`, ADR-0005).
 */
@ApiTags('observability')
@Controller('api/observability')
@UseGuards(AuthGuard)
export class ObservabilityController {
  constructor(private readonly counters: CounterService) {}

  @Get('metrics')
  metrics(): MetricsSnapshot {
    return buildSnapshot(this.counters, {
      uptimeSeconds: Math.round(process.uptime()),
      collectedAtMs: Date.now(),
    })
  }
}
