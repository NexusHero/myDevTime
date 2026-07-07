/**
 * Typed domain errors, mapped to RFC 7807 `application/problem+json` in one
 * place (see `app.ts`). Upstream code throws these; internals never leak to
 * clients, and error shape is consistent across every module.
 */

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
}

/** Base class for expected, client-facing errors. */
export class AppError extends Error {
  readonly status: number
  readonly type: string
  readonly title: string

  constructor(params: { status: number; type: string; title: string; detail?: string }) {
    super(params.detail ?? params.title)
    this.name = new.target.name
    this.status = params.status
    this.type = params.type
    this.title = params.title
  }

  toProblem(): ProblemDetails {
    const problem: ProblemDetails = { type: this.type, title: this.title, status: this.status }
    if (this.message && this.message !== this.title) problem.detail = this.message
    return problem
  }
}

export class NotFoundError extends AppError {
  constructor(detail?: string) {
    super({ status: 404, type: 'about:blank', title: 'Not Found', ...(detail ? { detail } : {}) })
  }
}

export class ValidationError extends AppError {
  constructor(detail?: string) {
    super({
      status: 400,
      type: 'about:blank',
      title: 'Bad Request',
      ...(detail ? { detail } : {}),
    })
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail?: string) {
    super({
      status: 401,
      type: 'about:blank',
      title: 'Unauthorized',
      ...(detail ? { detail } : {}),
    })
  }
}
