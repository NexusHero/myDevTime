import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { SharingController } from './sharing.controller.js'
import { SharingContext } from './sharing.context.js'

/**
 * The `sharing` module (REQ-064, design v17 §F6, ADR-0025): partner-light Free/Busy links.
 * Imports `AuthModule` for the `AuthGuard` on the management routes; the public Free/Busy route
 * is keyed by the link token instead. The projection math stays in `packages/domain/sharing`.
 */
@Module({
  imports: [AuthModule],
  controllers: [SharingController],
  providers: [SharingContext],
})
export class SharingModule {}
