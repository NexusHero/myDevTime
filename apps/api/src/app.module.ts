import { Module, type DynamicModule } from '@nestjs/common'
import { CoreModule, type CoreDeps } from './core/core.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { AutomationModule } from './modules/automation/automation.module.js'
import { AiModule } from './modules/ai/ai.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { TrackingModule } from './modules/tracking/tracking.module.js'
import { BillingModule } from './modules/billing/billing.module.js'
import { WorktimeModule } from './modules/worktime/worktime.module.js'
import { AbsencesModule } from './modules/absences/absences.module.js'
import { PlannerModule } from './modules/planner/planner.module.js'
import { PreferencesModule } from './modules/preferences/preferences.module.js'
import { ConnectorsModule } from './modules/connectors/connectors.module.js'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { APP_GUARD } from '@nestjs/core'
import { CONFIG } from './core/tokens.js'
import type { Config } from './config.js'

/**
 * The composition root (ADR-0025): `forRoot` wires the shared providers
 * (config + db, via `CoreModule`) and imports every feature module. Modules are
 * mounted under `/api/<name>` by a controller path prefix, preserving the
 * skeleton's URL layout (ADR-0015). Health stays at the root.
 */
@Module({})
export class AppModule {
  static forRoot(deps: CoreDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Global rate limiting (ADR-0050): 100 req/min per client. Redis-backed
        // so the counter is shared across API instances; without REDIS_URL it
        // falls back to per-instance in-memory counters (tests / single node) —
        // the `storage` key is omitted entirely so the default driver is used.
        ThrottlerModule.forRootAsync({
          inject: [CONFIG],
          useFactory: (config: Config) => ({
            throttlers: [{ ttl: 60000, limit: 100 }],
            ...(config.REDIS_URL
              ? { storage: new ThrottlerStorageRedisService(config.REDIS_URL) }
              : {}),
          }),
        }),
        CoreModule.forRoot(deps),
        HealthModule,
        AutomationModule,
        AiModule,
        AuthModule,
        TrackingModule,
        BillingModule,
        WorktimeModule,
        AbsencesModule,
        PlannerModule,
        PreferencesModule,
        ConnectorsModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }
  }
}
