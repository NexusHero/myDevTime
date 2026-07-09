import { Global, Module, type DynamicModule } from '@nestjs/common'
import type { Config } from '../config.js'
import type { DbHandle } from '../db/client.js'
import { CONFIG, DB, DB_HANDLE } from './tokens.js'

export interface CoreDeps {
  config: Config
  db: DbHandle | null
}

/**
 * The composition root's shared providers (ADR-0025): config and the database
 * handle/instance, provided once and made available app-wide. `@Global` so every
 * feature module can `@Inject(CONFIG)` / `@Inject(DB)` without importing this
 * module — the Nest equivalent of the old `deps` object, but resolved by the
 * container. The `postgres`/Drizzle driver stays confined to the `db` module
 * (ADR-0015); nothing in `packages/domain` is injected (it is pure).
 */
@Global()
@Module({})
export class CoreModule {
  static forRoot(deps: CoreDeps): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: CONFIG, useValue: deps.config },
        { provide: DB_HANDLE, useValue: deps.db },
        { provide: DB, useValue: deps.db?.db ?? null },
      ],
      exports: [CONFIG, DB_HANDLE, DB],
    }
  }
}
