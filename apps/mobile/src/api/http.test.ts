import { describe, expect, it } from 'vitest'
import { ApiError, problemToError } from './http.js'

/**
 * The problem→error mapping is the client's read of the API's RFC 7807 contract,
 * so it is pinned: a well-formed problem+json body surfaces its title/detail,
 * while a missing or non-object body falls back to a status-derived message.
 */
describe('problemToError', () => {
  it('ProblemJson_WithTitleAndDetail_SurfacesBoth', () => {
    const err = problemToError(401, { title: 'Unauthorized', status: 401, detail: 'no session' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(err.title).toBe('Unauthorized')
    expect(err.detail).toBe('no session')
    expect(err.message).toBe('no session')
  })

  it('ProblemJson_TitleOnly_MessageIsTitle', () => {
    const err = problemToError(404, { title: 'Not Found', status: 404 })
    expect(err.title).toBe('Not Found')
    expect(err.detail).toBeUndefined()
    expect(err.message).toBe('Not Found')
  })

  it('NonObjectBody_FallsBackToStatusMessage', () => {
    expect(problemToError(500, null).title).toBe('HTTP 500')
    expect(problemToError(503, 'oops').title).toBe('HTTP 503')
  })
})
