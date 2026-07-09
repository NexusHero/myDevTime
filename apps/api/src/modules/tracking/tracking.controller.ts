import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `tracking` module status probe (ADR-0003/0025) — the one unguarded route,
 * kept for parity with the other modules' `/status` smoke targets. Real
 * endpoints live on the catalog/entries controllers.
 */
@ApiTags('tracking')
@Controller('api/tracking')
export class TrackingStatusController {
  @Get('status')
  status(): { module: 'tracking'; status: 'ok' } {
    return { module: 'tracking', status: 'ok' }
  }
}
