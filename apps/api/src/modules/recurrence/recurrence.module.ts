import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { RecurrenceController } from './recurrence.controller.js'
import { RecurrenceContext } from './recurrence.context.js'

/**
 * The `recurrence` module (REQ-060, design v17 §F4, ADR-0025): recurring-entry series and their
 * projected occurrences. Imports `AuthModule` to consume the exported `AuthGuard`; the shared
 * `RecurrenceContext` resolves each caller's workspace over the `DB` token. The occurrence math
 * stays in `packages/domain/recurrence`.
 */
@Module({
  imports: [AuthModule],
  controllers: [RecurrenceController],
  providers: [RecurrenceContext],
})
export class RecurrenceModule {}
