import { Module, type DynamicModule } from '@nestjs/common'
import { CoreModule, type CoreDeps } from './core/core.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { AutomationModule } from './modules/automation/automation.module.js'
import { AiModule } from './modules/ai/ai.module.js'

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
      imports: [CoreModule.forRoot(deps), HealthModule, AutomationModule, AiModule],
    }
  }
}
