import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `planner` module status probe (ADR-0003/0025) — the one unguarded route,
 * kept for parity with the other modules' `/status` smoke targets. Real endpoints
 * live on the planner controller.
 */
@ApiTags('planner')
@Controller('api/planner')
export class PlannerStatusController {
  @Get('status')
  status(): { module: 'planner'; status: 'ok' } {
    return { module: 'planner', status: 'ok' }
  }
}
