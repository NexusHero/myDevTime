import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard } from '../auth/contract.js'
import { NlEntryService } from './nl-entry.service.js'
import { NlEntryDto } from './ai.dto.js'

/**
 * The `ai` module (LLM proposals, NL entry, assistant — ADR-0025/0029). The status
 * route stays unguarded for boundary parity; real AI endpoints run behind
 * `AuthGuard`. NL time entry (REQ-013) returns a **draft only** — the client
 * confirms it before anything is written (ADR-0005).
 */
@ApiTags('ai')
@Controller('api/ai')
export class AiController {
  constructor(private readonly nlEntry: NlEntryService) {}

  @Get('status')
  status(): { module: 'ai'; status: 'ok' } {
    return { module: 'ai', status: 'ok' }
  }

  @Post('nl-entry')
  @UseGuards(AuthGuard)
  async parseNlEntry(@Body() body: NlEntryDto) {
    return this.nlEntry.draft(body.text, body.knownProjects ?? [])
  }
}
