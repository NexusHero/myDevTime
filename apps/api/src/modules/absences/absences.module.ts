import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AbsencesController } from './absences.controller.js'
import { AbsencesStatusController } from './absences.status.controller.js'
import { AbsencesContext } from './absences.context.js'

/**
 * The `absences` module (REQ-029, ADR-0010/0025): leave ranges + the vacation
 * policy and allowance balance. Imports `AuthModule` to consume the exported
 * `AuthGuard`; the shared `AbsencesContext` resolves each caller's workspace over
 * the `DB` token. The deterministic allowance math stays in
 * `packages/domain/absences`.
 */
@Module({
  imports: [AuthModule],
  controllers: [AbsencesStatusController, AbsencesController],
  providers: [AbsencesContext],
})
export class AbsencesModule {}
