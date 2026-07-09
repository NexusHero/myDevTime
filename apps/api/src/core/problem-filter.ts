import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { AppError, type ProblemDetails } from '../errors.js'

const PROBLEM_CONTENT_TYPE = 'application/problem+json'

const REASON: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

/** Canonical RFC 7807 title for a status code (falls back to a generic phrase). */
function reasonPhrase(status: number): string {
  return REASON[status] ?? (status >= 500 ? 'Server Error' : 'Request Error')
}

/**
 * One filter maps every thrown error to RFC 7807 `application/problem+json`
 * (ADR-0025, preserving ADR-0015's error convention): typed domain errors
 * (`AppError`) keep their status/title/detail; Nest `HttpException`s (incl.
 * nestjs-zod validation → 400) map to a problem with their status; anything else
 * is a logged 500 that never leaks internals to the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http')

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>()

    if (exception instanceof AppError) {
      void reply.status(exception.status).type(PROBLEM_CONTENT_TYPE).send(exception.toProblem())
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const problem: ProblemDetails = {
        type: 'about:blank',
        title: reasonPhrase(status),
        status,
      }
      const detail = exception.message
      if (detail && detail !== problem.title) problem.detail = detail
      void reply.status(status).type(PROBLEM_CONTENT_TYPE).send(problem)
      return
    }

    this.logger.error('unhandled error', exception instanceof Error ? exception.stack : exception)
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    }
    void reply.status(500).type(PROBLEM_CONTENT_TYPE).send(problem)
  }
}
