import { Controller, Get, Inject, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { Redis } from 'ioredis'
import { CONFIG, DB_HANDLE, type ConfigToken, type DbHandleToken } from '../../core/tokens.js'

interface Live {
  status: 'ok'
}
interface Ready {
  status: 'ready'
  db: 'up'
  redis: 'up' | 'not_configured'
}
interface NotReady {
  status: 'not_ready'
  db: 'down' | 'not_configured' | 'up'
  redis?: 'down' | 'up' | 'not_configured'
}

/**
 * Liveness (`/health`, no I/O) and readiness (`/health/ready`, pings the DB) —
 * the cross-cutting operational concern, kept outside the business modules
 * (ADR-0025, preserving the Fastify skeleton's health routes). Readiness sets a
 * 503 via the passthrough reply so Nest still serializes the typed body.
 */
// Health probes are hit continuously by container/orchestrator liveness &
// readiness checks; they must never be rate-limited (ADR-0050).
@SkipThrottle()
@ApiTags('health')
@Controller()
export class HealthController {
  /** A lazily-connected Redis client reused across probes, or null when Redis is
   *  not configured. Redis backs the global rate limiter (app.module.ts), so a pod
   *  that can't reach it must not report ready under a multi-instance deployment. */
  private readonly redis: Redis | null

  constructor(
    @Inject(DB_HANDLE) private readonly db: DbHandleToken,
    @Inject(CONFIG) config: ConfigToken,
  ) {
    this.redis = config.REDIS_URL
      ? new Redis(config.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null
  }

  @Get('health')
  liveness(): Live {
    return { status: 'ok' }
  }

  @Get('health/ready')
  async readiness(@Res({ passthrough: true }) reply: FastifyReply): Promise<Ready | NotReady> {
    if (!this.db) {
      void reply.status(503)
      return { status: 'not_ready', db: 'not_configured' }
    }
    try {
      await this.db.sql`select 1`
    } catch {
      void reply.status(503)
      return { status: 'not_ready', db: 'down' }
    }
    if (this.redis) {
      try {
        await this.redis.ping()
      } catch {
        void reply.status(503)
        return { status: 'not_ready', db: 'up', redis: 'down' }
      }
      return { status: 'ready', db: 'up', redis: 'up' }
    }
    return { status: 'ready', db: 'up', redis: 'not_configured' }
  }
}
