import { Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { ConflictError } from '../connectors/oauth.js'
import { getPreferences } from '../preferences/contract.js'
import { WellbeingContext } from './wellbeing.context.js'
import { LoadHistoryQueryDto, RecordMoodDto } from './wellbeing.dto.js'
import { WellbeingService } from './service.js'

/** How many most-recent mood days a history read returns (~a quarter of patterns). */
const MOOD_HISTORY_DAYS = 90

/**
 * The `wellbeing` mood surface (ADR-0071 P3, REQ-068): persist the punch-out MoodCheck word —
 * **only** under the caller's explicit `moodConsent` preference — read the history back, and
 * erase it all in one action. Every route runs behind `AuthGuard` and scopes to the caller's
 * workspace + user via `WellbeingContext`. Consent is enforced *server-side* on the write path
 * (an honest 409, mirroring the REQ-025 pattern): without the stored opt-in, storage is
 * impossible, not merely hidden. The mood value itself is never logged on any of these paths.
 */
@ApiTags('wellbeing')
@Controller('api/wellbeing')
@UseGuards(AuthGuard)
export class WellbeingController {
  constructor(
    private readonly ctx: WellbeingContext,
    private readonly wellbeing: WellbeingService,
  ) {}

  @Post('mood')
  @HttpCode(200)
  async record(@CurrentUser() user: AuthenticatedUser, @Body() body: RecordMoodDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const prefs = await getPreferences(db, workspaceId, userId)
    if (!prefs.moodConsent) {
      throw new ConflictError('mood memory requires the explicit moodConsent preference')
    }
    // The server owns "today": the punch-out client sends no clock, UTC keys the day.
    const day = body.day ?? new Date().toISOString().slice(0, 10)
    await this.wellbeing.recordMood(db, { workspaceId, userId, day, mood: body.mood })
    return { day, mood: body.mood }
  }

  @Get('mood')
  async history(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return this.wellbeing.moodHistory(db, { workspaceId, userId }, MOOD_HISTORY_DAYS)
  }

  @Delete('mood')
  async erase(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    await this.wellbeing.deleteAllMoods(db, { workspaceId, userId })
    return { deleted: true }
  }

  /**
   * The caller's own load-score history (oldest→newest), the raw series the client feeds into
   * `computeBaseline` (H3): the live-load watch and the life-care voices judge "hard" against
   * *this person's* band, never a fixed number. Free, deterministic, and — like every wellbeing
   * surface — never paywalled (REQ-056). Read-only; the series is written solely by the
   * evening-companion path.
   */
  @Get('load-history')
  async loadHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: LoadHistoryQueryDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return this.wellbeing.recentLoadHistory(db, { workspaceId, userId }, query.days)
  }
}
