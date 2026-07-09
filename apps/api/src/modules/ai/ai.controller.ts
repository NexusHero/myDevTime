import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * The `ai` module (LLM proposals, NL entry, assistant — M3). A documented status
 * route proves the module boundary until its real endpoints land (ADR-0025).
 */
@ApiTags('ai')
@Controller('api/ai')
export class AiController {
  @Get('status')
  status(): { module: 'ai'; status: 'ok' } {
    return { module: 'ai', status: 'ok' }
  }
}
