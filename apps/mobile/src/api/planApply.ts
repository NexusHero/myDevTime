import { getJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The plan-apply client seam (ADR-0071 P4, REQ-070): send exactly ONE user-confirmed Sevi
 * proposal to `POST /api/planner/apply` — protect a window, move a block, or shrink one —
 * and read back the day's 🛡 protected windows for nudge gating + rendering. Mirrors the
 * server's `PlanProposal` union verbatim; the mutation itself is the server core's
 * (ADR-0005), the client only confirms and parses. A malformed echo throws — the UI must
 * never pretend a proposal landed.
 */
export type PlanProposal =
  | { kind: 'protect-time'; day: string; startMin: number; endMin: number }
  | { kind: 'move-block'; planId: string; blockId: string; toStartMin: number }
  | { kind: 'shrink-block'; planId: string; blockId: string; byMin: number }
  | {
      kind: 'relayout-day'
      planId: string
      placements: { blockId: string; startMin: number; lenMin: number }[]
      provenance: 'planner-reflow'
    }
  | {
      kind: 'add-blocks'
      day: string
      blocks: {
        startMin: number
        lenMin: number
        kind: 'meeting' | 'focus' | 'break'
        label: string
        taskId?: string
      }[]
      provenance: 'planner-fill' | 'planner-firstrun'
    }

const planProposalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('protect-time'),
    day: z.string(),
    startMin: z.number(),
    endMin: z.number(),
  }),
  z.object({
    kind: z.literal('move-block'),
    planId: z.string(),
    blockId: z.string(),
    toStartMin: z.number(),
  }),
  z.object({
    kind: z.literal('shrink-block'),
    planId: z.string(),
    blockId: z.string(),
    byMin: z.number(),
  }),
  // Batch kinds of the daily loop (ADR-0072): one-tap repair + fill-week/first-run ride the
  // same POST; a batch is never empty (mirrors the server's nonempty rule).
  z.object({
    kind: z.literal('relayout-day'),
    planId: z.string(),
    placements: z
      .array(z.object({ blockId: z.string(), startMin: z.number(), lenMin: z.number() }))
      .min(1),
    provenance: z.literal('planner-reflow'),
  }),
  z.object({
    kind: z.literal('add-blocks'),
    day: z.string(),
    blocks: z
      .array(
        z.object({
          startMin: z.number(),
          lenMin: z.number(),
          kind: z.enum(['meeting', 'focus', 'break']),
          label: z.string(),
          taskId: z.string().optional(),
        }),
      )
      .min(1),
    provenance: z.enum(['planner-fill', 'planner-firstrun']),
  }),
])

const appliedSchema = z.object({
  applied: z.object({
    proposal: planProposalSchema,
    resultPlanId: z.string().optional(),
  }),
})
export type AppliedProposal = z.infer<typeof appliedSchema>['applied']

export const protectedTimeSchema = z.object({
  id: z.string(),
  day: z.string(),
  startMin: z.number(),
  endMin: z.number(),
  source: z.string(),
})
export type ProtectedTime = z.infer<typeof protectedTimeSchema>

/** Apply one confirmed proposal; returns the applied echo (+ the new plan id for mutations). */
export async function applyPlanProposal(
  baseUrl: string,
  proposal: PlanProposal,
  fetchImpl: typeof fetch = fetch,
): Promise<AppliedProposal> {
  const res = await postJson(baseUrl, '/api/planner/apply', { proposal }, fetchImpl)
  return appliedSchema.parse(res).applied
}

/** The caller's 🛡 protected windows for `day` (`YYYY-MM-DD`). */
export async function getProtectedTimes(
  baseUrl: string,
  day: string,
  fetchImpl: typeof fetch = fetch,
): Promise<readonly ProtectedTime[]> {
  const qs = new URLSearchParams({ day }).toString()
  const res = await getJson(baseUrl, `/api/planner/protected?${qs}`, fetchImpl)
  return z.array(protectedTimeSchema).parse(res)
}
