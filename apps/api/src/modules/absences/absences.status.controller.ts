import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `absences` module status probe (ADR-0003/0025) — the one unguarded route,
 * kept for parity with the other modules' `/status` smoke targets. Real endpoints
 * live on the absences controller.
 */
@ApiTags('absences')
@Controller('api/absences')
export class AbsencesStatusController {
  @Get('status')
  status(): { module: 'absences'; status: 'ok' } {
    return { module: 'absences', status: 'ok' }
  }
}
