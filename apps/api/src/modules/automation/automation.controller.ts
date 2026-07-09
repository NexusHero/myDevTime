import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `automation` module (calendar ingestion, rules engine — M3). A documented
 * status route proves the module boundary until its real endpoints land
 * (ADR-0025, preserving the skeleton's `/status` smoke target).
 */
@ApiTags('automation')
@Controller('api/automation')
export class AutomationController {
  @Get('status')
  status(): { module: 'automation'; status: 'ok' } {
    return { module: 'automation', status: 'ok' }
  }
}
