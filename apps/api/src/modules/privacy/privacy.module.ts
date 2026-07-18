import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { PrivacyController } from './privacy.controller.js'
import { PrivacyContext } from './privacy.context.js'

/** The `privacy` module (ADR-0025): GDPR export, erasure, and retention purge (REQ-020). */
@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyContext],
})
export class PrivacyModule {}
