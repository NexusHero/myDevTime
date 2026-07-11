import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PreferencesController } from './preferences.controller.js'
import { PreferencesContext } from './preferences.context.js'

/**
 * The `preferences` module (M10, ADR-0025): per-user, per-workspace Settings
 * toggles. Imports `AuthModule` for the exported `AuthGuard`; `PreferencesContext`
 * resolves each caller's workspace + user over the `DB` token, so state is
 * workspace-isolated by construction.
 */
@Module({
  imports: [AuthModule],
  controllers: [PreferencesController],
  providers: [PreferencesContext],
})
export class PreferencesModule {}
