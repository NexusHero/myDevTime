import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ZodValidationPipe } from 'nestjs-zod'
import { loadConfig } from './config.js'
import { createDb, type DbHandle } from './db/client.js'
import { AppModule } from './app.module.js'
import { ProblemDetailsFilter } from './core/problem-filter.js'

/**
 * Compose config → db → Nest app (on the Fastify adapter) → listen, with graceful
 * shutdown (ADR-0025). The Fastify adapter keeps our HTTP layer + logging; NestJS
 * owns modules, DI, and lifecycle. `reflect-metadata` is imported first so DI
 * metadata is available.
 */
export async function bootstrap(): Promise<NestFastifyApplication> {
  const config = loadConfig()
  const db: DbHandle | null = config.DATABASE_URL ? createDb(config.DATABASE_URL) : null

  const adapter = new FastifyAdapter({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  })

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ config, db }),
    adapter,
    {
      bufferLogs: false,
    },
  )
  app.useGlobalFilters(new ProblemDetailsFilter())
  app.useGlobalPipes(new ZodValidationPipe())

  const openapi = new DocumentBuilder().setTitle('myDevTime API').setVersion('0.0.0').build()
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openapi))

  const shutdown = (signal: string): void => {
    void (async () => {
      await app.close()
      if (db) await db.close()
      process.exit(0)
    })()
    void signal
  }
  process.once('SIGTERM', () => {
    shutdown('SIGTERM')
  })
  process.once('SIGINT', () => {
    shutdown('SIGINT')
  })

  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  return app
}

// Only auto-start when run directly (not when imported by tests).
if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
