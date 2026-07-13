import { Controller, Get, Inject, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { DB_HANDLE, type DbHandleToken } from '../../core/tokens.js'

interface Live {
  status: 'ok'
}
interface Ready {
  status: 'ready'
  db: 'up'
}
interface NotReady {
  status: 'not_ready'
  db: 'down' | 'not_configured'
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
  constructor(@Inject(DB_HANDLE) private readonly db: DbHandleToken) {}

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
      return { status: 'ready', db: 'up' }
    } catch {
      void reply.status(503)
      return { status: 'not_ready', db: 'down' }
    }
  }
}
