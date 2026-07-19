import { Injectable } from '@nestjs/common'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { catchError, tap, throwError } from 'rxjs'
import { CounterService, METRIC } from './counter.service.js'
import { statusClassMetric, statusOfError } from './metrics.js'

/**
 * The single producer of the request counters (REQ-021): a global interceptor that
 * tallies every HTTP request that flows through Nest — one `requests.total` plus one
 * status-class counter — on both the success path (`tap`, reading the final reply
 * status) and the error path (`catchError`, classifying the thrown error exactly as
 * `ProblemDetailsFilter` will, then rethrowing so behaviour is unchanged). Non-HTTP
 * contexts pass through untouched. It only ever calls `increment`; the counting logic
 * it relies on is the pure helpers in `metrics.ts`.
 */
@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly counters: CounterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const http = context.switchToHttp()
    const record = (status: number): void => {
      this.counters.increment(METRIC.requestsTotal)
      this.counters.increment(statusClassMetric(status))
    }
    return next.handle().pipe(
      tap(() => {
        const res = http.getResponse<{ statusCode?: number }>()
        record(res.statusCode ?? 200)
      }),
      catchError((err: unknown) => {
        record(statusOfError(err))
        return throwError(() => err)
      }),
    )
  }
}
