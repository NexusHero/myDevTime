import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { PreferencesContext } from './preferences.context.js'
import { UpdatePreferencesDto } from './preferences.dto.js'
import { getPreferences, setPreferences } from './service.js'

/**
 * The `preferences` surface (M10): read and update the caller's Settings toggles.
 * Behind `AuthGuard`; scopes to the caller's workspace + user via
 * `PreferencesContext`, so a toggle is stored and read for exactly that user in
 * that workspace and survives a reload.
 */
@ApiTags('preferences')
@Controller('api/preferences')
@UseGuards(AuthGuard)
export class PreferencesController {
  constructor(private readonly ctx: PreferencesContext) {}

  @Get()
  async read(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return getPreferences(db, workspaceId, userId)
  }

  @Put()
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdatePreferencesDto) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return setPreferences(db, workspaceId, userId, body)
  }
}
