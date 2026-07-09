import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `billing` module status probe (ADR-0003/0025) — the one unguarded route,
 * kept for parity with the other modules' `/status` smoke targets.
 */
@ApiTags('billing')
@Controller('api/billing')
export class BillingStatusController {
  @Get('status')
  status(): { module: 'billing'; status: 'ok' } {
    return { module: 'billing', status: 'ok' }
  }
}
