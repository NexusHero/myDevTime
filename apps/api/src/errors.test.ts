import { describe, expect, it } from 'vitest'
import { AppError, NotFoundError, ValidationError, UnauthorizedError } from './errors.js'

describe('AppError.toProblem', () => {
  it('ToProblem_WithDetail_IncludesDetail', () => {
    const err = new AppError({
      status: 418,
      type: 'about:blank',
      title: "I'm a teapot",
      detail: 'no coffee here',
    })

    const problem = err.toProblem()

    expect(problem).toEqual({
      type: 'about:blank',
      title: "I'm a teapot",
      status: 418,
      detail: 'no coffee here',
    })
  })

  it('ToProblem_DetailEqualsTitle_OmitsDetail', () => {
    const err = new AppError({ status: 400, type: 'about:blank', title: 'Bad Request' })

    const problem = err.toProblem()

    expect(problem.detail).toBeUndefined()
  })

  it('NotFoundError_Defaults_To404', () => {
    expect(new NotFoundError().status).toBe(404)
  })

  it('ValidationError_Defaults_To400', () => {
    expect(new ValidationError('bad field').toProblem()).toMatchObject({
      status: 400,
      detail: 'bad field',
    })
  })

  it('UnauthorizedError_Defaults_To401', () => {
    expect(new UnauthorizedError().status).toBe(401)
  })
})
