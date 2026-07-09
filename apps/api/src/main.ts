import { loadConfig } from './config.js'
import { createDb, type DbHandle } from './db/client.js'
import { buildApp } from './app.js'

/**
 * Compose config → db → app → listen, with graceful shutdown (ADR-0025). The Nest
 * app (on the Fastify adapter) is built by `buildApp`; here we only own the
 * process lifecycle: bind the port and close the app + db on a signal.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig()
  const db: DbHandle | null = config.DATABASE_URL ? createDb(config.DATABASE_URL) : null

  const app = await buildApp({ config, db })

  const shutdown = (): void => {
    void (async () => {
      await app.close()
      if (db) await db.close()
      process.exit(0)
    })()
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
}

bootstrap().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
