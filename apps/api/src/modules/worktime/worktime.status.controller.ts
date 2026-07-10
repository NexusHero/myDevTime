import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `worktime` module status probe (ADR-0003/0025) — the one unguarded route,
 * kept for parity with the other modules' `/status` smoke targets. Real endpoints
 * live on the attendance controller.
 */
@ApiTags('worktime')
@Controller('api/worktime')
export class WorktimeStatusController {
  @Get('status')
  status(): { module: 'worktime'; status: 'ok' } {
    return { module: 'worktime', status: 'ok' }
  }
}
