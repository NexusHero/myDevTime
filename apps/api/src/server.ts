import { loadConfig } from './config.js'
import { createDb, type DbHandle } from './db/client.js'
import { buildApp } from './app.js'

/** Compose config → db → app → listen, with graceful shutdown. */
async function main(): Promise<void> {
  const config = loadConfig()
  const dbHandle: DbHandle | null = config.DATABASE_URL ? createDb(config.DATABASE_URL) : null

  const app = await buildApp({ config, db: dbHandle })

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, 'shutting down')
    void (async () => {
      await app.close()
      if (dbHandle) await dbHandle.close()
      process.exit(0)
    })()
  }
  process.on('SIGTERM', () => {
    shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    shutdown('SIGINT')
  })

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
