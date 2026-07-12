import { Module } from '@nestjs/common'
import { CONFIG, type ConfigToken } from '../../core/tokens.js'
import { AuthModule } from '../auth/auth.module.js'
import { SyncController } from './sync.controller.js'
import { loadPowerSyncKeys } from './powersync-auth.js'
import { POWERSYNC_KEYS, type PowerSyncKeysToken } from './sync.tokens.js'

/** The `sync` module (ADR-0019/0025/0043). Imports auth for the shared `AuthGuard`. */
@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [
    {
      provide: POWERSYNC_KEYS,
      inject: [CONFIG],
      useFactory: (config: ConfigToken): Promise<PowerSyncKeysToken> =>
        loadPowerSyncKeys(config.POWERSYNC_JWT_PRIVATE_JWK),
    },
  ],
})
export class SyncModule {}
