import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { SyncController } from './sync.controller.js'

/** The `sync` module (ADR-0019/0025). Imports auth for the shared `AuthGuard`. */
@Module({ imports: [AuthModule], controllers: [SyncController] })
export class SyncModule {}
