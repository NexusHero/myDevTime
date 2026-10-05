import { describe, expect, it } from 'vitest'
import { evaluateRuns } from './wait-for-checks.mjs'

const REQUIRED = ['CI', 'Security', 'CodeQL']

/** A workflow run as the GitHub REST API returns it (only the fields we read). */
function run(name, status, conclusion = null, { id = 1, event = 'push' } = {}) {
  return { id, name, event, status, conclusion }
}

const allGreen = [
  run('CI', 'completed', 'success'),
  run('Security', 'completed', 'success'),
  run('CodeQL', 'completed', 'success'),
]

describe('evaluateRuns', () => {
  it('passes when every required workflow of this push succeeded', () => {
    expect(evaluateRuns(allGreen, { required: REQUIRED }).state).toBe('success')
  })

  it('waits while a required workflow has not started yet', () => {
    const verdict = evaluateRuns(allGreen.slice(0, 2), { required: REQUIRED })

    expect(verdict.state).toBe('pending')
    expect(verdict.reason).toContain('CodeQL')
  })

  it('waits while a required workflow is still queued or running', () => {
    const runs = [...allGreen.slice(0, 2), run('CodeQL', 'in_progress')]

    const verdict = evaluateRuns(runs, { required: REQUIRED })

    expect(verdict.state).toBe('pending')
    expect(verdict.reason).toContain('CodeQL')
  })

  it('fails as soon as a required workflow failed, even with others still running', () => {
    const runs = [run('CI', 'completed', 'failure'), run('Security', 'queued')]

    const verdict = evaluateRuns(runs, { required: REQUIRED })

    expect(verdict.state).toBe('failure')
    expect(verdict.reason).toContain('CI (failure)')
  })

  it.each(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'])(
    'treats a %s conclusion as blocking',
    conclusion => {
      const runs = [...allGreen.slice(1), run('CI', 'completed', conclusion)]

      expect(evaluateRuns(runs, { required: REQUIRED }).state).toBe('failure')
    },
  )

  it('ignores workflows it was not asked to wait for, red or not', () => {
    const runs = [...allGreen, run('Pages — API docs', 'completed', 'failure')]

    expect(evaluateRuns(runs, { required: REQUIRED }).state).toBe('success')
  })

  it('only judges runs triggered by the push, not a scheduled scan of the same commit', () => {
    const runs = [
      ...allGreen.slice(0, 2),
      run('CodeQL', 'completed', 'failure', { id: 9, event: 'schedule' }),
    ]

    const verdict = evaluateRuns(runs, { required: REQUIRED })

    expect(verdict.state).toBe('pending')
  })

  it('judges a workflow by its newest run when it ran more than once for the commit', () => {
    const runs = [
      ...allGreen.slice(1),
      run('CI', 'completed', 'failure', { id: 1 }),
      run('CI', 'completed', 'success', { id: 2 }),
    ]

    expect(evaluateRuns(runs, { required: REQUIRED }).state).toBe('success')
  })

  it('matches workflow names exactly, so a prefix cannot stand in for a required one', () => {
    const runs = [...allGreen.slice(1), run('CI nightly', 'completed', 'success')]

    expect(evaluateRuns(runs, { required: REQUIRED }).state).toBe('pending')
  })
})
