import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { firstValueFrom, of, throwError } from 'rxjs'
import { UnauthorizedError } from '../../errors.js'
import { CounterService, METRIC } from './counter.service.js'
import { RequestMetricsInterceptor } from './observability.interceptor.js'

/** A minimal HTTP `ExecutionContext` whose reply reports the given status code. */
function httpContext(statusCode: number | undefined): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
  } as unknown as ExecutionContext
}

const handlerOf = (value: unknown): CallHandler => ({ handle: () => of(value) })
const handlerThrowing = (err: unknown): CallHandler => ({ handle: () => throwError(() => err) })

/**
 * The request-metrics interceptor (REQ-021): counts total + the right status class on
 * both success and error, and leaves non-HTTP contexts untouched. Driven directly with
 * a stub context/handler so the counting is deterministic and DB-free.
 */
describe('RequestMetricsInterceptor', () => {
  it('CountsA2xxAsTotalPlusOk', async () => {
    const counters = new CounterService()
    const interceptor = new RequestMetricsInterceptor(counters)
    await firstValueFrom(interceptor.intercept(httpContext(200), handlerOf('body')))
    expect(counters.get(METRIC.requestsTotal)).toBe(1)
    expect(counters.get(METRIC.requestsOk)).toBe(1)
    expect(counters.get(METRIC.requestsClientError)).toBe(0)
    expect(counters.get(METRIC.requestsServerError)).toBe(0)
  })

  it('DefaultsToTwoHundredWhenTheReplyHasNoStatus', async () => {
    const counters = new CounterService()
    const interceptor = new RequestMetricsInterceptor(counters)
    await firstValueFrom(interceptor.intercept(httpContext(undefined), handlerOf('body')))
    expect(counters.get(METRIC.requestsOk)).toBe(1)
  })

  it('CountsAThrownAppErrorByItsStatusClassAndRethrows', async () => {
    const counters = new CounterService()
    const interceptor = new RequestMetricsInterceptor(counters)
    await expect(
      firstValueFrom(
        interceptor.intercept(httpContext(200), handlerThrowing(new UnauthorizedError())),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError)
    expect(counters.get(METRIC.requestsTotal)).toBe(1)
    expect(counters.get(METRIC.requestsClientError)).toBe(1)
    expect(counters.get(METRIC.requestsServerError)).toBe(0)
  })

  it('CountsAnUnknownThrownErrorAsAServerError', async () => {
    const counters = new CounterService()
    const interceptor = new RequestMetricsInterceptor(counters)
    await expect(
      firstValueFrom(interceptor.intercept(httpContext(200), handlerThrowing(new Error('boom')))),
    ).rejects.toThrow('boom')
    expect(counters.get(METRIC.requestsServerError)).toBe(1)
  })

  it('IgnoresNonHttpContexts', async () => {
    const counters = new CounterService()
    const interceptor = new RequestMetricsInterceptor(counters)
    const rpcContext = { getType: () => 'rpc' } as unknown as ExecutionContext
    await firstValueFrom(interceptor.intercept(rpcContext, handlerOf('body')))
    expect(counters.get(METRIC.requestsTotal)).toBe(0)
  })
})
