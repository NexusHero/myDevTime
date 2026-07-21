import { describe, expect, it, vi } from 'vitest'
import { applyPlanProposal, getProtectedTimes, type PlanProposal } from './planApply.js'

/**
 * The plan-apply client seam (ADR-0071 P4, REQ-070): POST exactly ONE user-confirmed proposal
 * and read back the day's 🛡 protected windows. These pin the routes/methods with the
 * closure-capture fake fetch, the zod parse of both responses, and that a malformed apply
 * echo throws rather than pretending the proposal landed.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const protect: PlanProposal = {
  kind: 'protect-time',
  day: '2026-07-21',
  startMin: 480,
  endMin: 720,
}

describe('applyPlanProposal', () => {
  it('PostsTheProposalToTheApplyRoute_AndParsesTheAppliedEcho', async () => {
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seenUrl = url
      seenInit = init
      return Promise.resolve(jsonResponse(200, { applied: { proposal: protect } }))
    }) as unknown as typeof fetch

    const out = await applyPlanProposal('https://api.test', protect, fetchImpl)

    expect(seenUrl).toBe('https://api.test/api/planner/apply')
    expect(seenInit?.method).toBe('POST')
    expect(JSON.parse((seenInit?.body as string | undefined) ?? '{}')).toEqual({
      proposal: protect,
    })
    expect(out).toEqual({ proposal: protect })
  })

  it('ParsesTheResultPlanIdOfABlockMutation', async () => {
    const move: PlanProposal = {
      kind: 'move-block',
      planId: '3e9a3a3e-7b56-4b2c-9c39-3a2f9adcb111',
      blockId: '1',
      toStartMin: 360,
    }
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { applied: { proposal: move, resultPlanId: 'p-2' } })),
    )
    const out = await applyPlanProposal('https://api.test', move, fetchImpl)
    expect(out.resultPlanId).toBe('p-2')
  })

  it('MalformedApplyEcho_ThrowsRatherThanPretendingSuccess', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true })))
    await expect(
      applyPlanProposal('https://api.test', protect, fetchImpl as typeof fetch),
    ).rejects.toThrow()
  })
})

describe('getProtectedTimes', () => {
  it('GetsTheDaysWindowsAndParsesThem', async () => {
    let seenUrl = ''
    const fetchImpl = ((url: string) => {
      seenUrl = url
      return Promise.resolve(
        jsonResponse(200, [
          { id: 'pt-1', day: '2026-07-21', startMin: 480, endMin: 720, source: 'sevi-proposal' },
        ]),
      )
    }) as unknown as typeof fetch

    const windows = await getProtectedTimes('https://api.test', '2026-07-21', fetchImpl)

    expect(seenUrl).toBe('https://api.test/api/planner/protected?day=2026-07-21')
    expect(windows).toEqual([
      { id: 'pt-1', day: '2026-07-21', startMin: 480, endMin: 720, source: 'sevi-proposal' },
    ])
  })

  it('NonOkResponse_ThrowsApiErrorFromProblemJson', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse(401, { title: 'Unauthorized', detail: 'no session' })),
    )
    await expect(
      getProtectedTimes('https://api.test', '2026-07-21', fetchImpl as typeof fetch),
    ).rejects.toMatchObject({ name: 'ApiError', status: 401 })
  })
})
