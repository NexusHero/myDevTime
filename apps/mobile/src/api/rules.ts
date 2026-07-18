import { deleteJson, getJson, patchJson, postJson } from './http.js'
import { z } from 'zod'

/**
 * The categorization-rules client (REQ-011, ADR-0005). Thin, typed wrappers over the
 * `automation` API: CRUD over the workspace's ordered `matcher → action` rules, plus a
 * **dry-run** that previews what the deterministic engine would propose over a batch of
 * subjects — the server never applies anything, so the editor always shows a proposal the
 * user reviews. Every field the API omits is defaulted here so the UI never sees `undefined`.
 */
export const matcherSchema = z.object({
  noteContains: z.string().optional(),
  sourceIs: z.string().optional(),
  projectIsEmpty: z.boolean().optional(),
  startWithin: z.object({ fromMin: z.number(), toMin: z.number() }).optional(),
  weekdayIn: z.array(z.number()).optional(),
})
export type RuleMatcher = z.infer<typeof matcherSchema>

export const actionSchema = z.object({
  setProjectId: z.string().optional(),
  setTaskId: z.string().optional(),
  addTags: z.array(z.string()).optional(),
  setBillable: z.boolean().optional(),
})
export type RuleAction = z.infer<typeof actionSchema>

export const ruleSchema = z.object({
  id: z.string(),
  order: z.number().catch(0).default(0),
  version: z.number().catch(1).default(1),
  matcher: matcherSchema.catch({}).default({}),
  action: actionSchema.catch({}).default({}),
  enabled: z.boolean().catch(true).default(true),
})
export type Rule = z.infer<typeof ruleSchema>

/** One dry-run preview row: the caller's key and the winning match (or `null` when nothing fits). */
export const dryRunRowSchema = z.object({
  key: z.string(),
  match: z
    .object({
      ruleId: z.string(),
      action: actionSchema.catch({}).default({}),
      provenance: z.string(),
    })
    .nullable()
    .catch(null)
    .default(null),
})
export type DryRunRow = z.infer<typeof dryRunRowSchema>

/** A rule's editable fields — what create/update accept (id/version are server-owned). */
export interface RuleInput {
  readonly order?: number
  readonly matcher?: RuleMatcher
  readonly action?: RuleAction
  readonly enabled?: boolean
}

/** A dry-run subject: the narrow projection of a time entry the engine matches against. */
export interface DryRunSubject {
  readonly note?: string
  readonly projectId?: string | null
  readonly source?: string
  readonly startMin?: number
  readonly weekday?: number
}

export function parseRule(value: unknown): Rule {
  return ruleSchema.parse(value)
}

/** List the workspace's rules in evaluation order (lower `order` runs first). */
export async function getRules(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<Rule[]> {
  const res = await getJson(baseUrl, '/api/automation/rules', fetchImpl)
  return z.array(ruleSchema).parse(res)
}

/** Create a rule; returns the stored rule (version 1). */
export async function createRule(
  baseUrl: string,
  input: RuleInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Rule> {
  const res = await postJson(baseUrl, '/api/automation/rules', input, fetchImpl)
  return ruleSchema.parse(res)
}

/** Patch a rule; the server bumps `version` on every change. */
export async function updateRule(
  baseUrl: string,
  id: string,
  patch: RuleInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Rule> {
  const res = await patchJson(baseUrl, `/api/automation/rules/${id}`, patch, fetchImpl)
  return ruleSchema.parse(res)
}

/** Soft-delete a rule (kept server-side for provenance stability). */
export async function deleteRule(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, `/api/automation/rules/${id}`, fetchImpl)
}

/** Preview the rule set over subjects **without applying anything** (ADR-0005). */
export async function dryRunRules(
  baseUrl: string,
  subjects: readonly { key: string; subject: DryRunSubject }[],
  fetchImpl: typeof fetch = fetch,
): Promise<DryRunRow[]> {
  const res = await postJson(baseUrl, '/api/automation/rules/dry-run', { subjects }, fetchImpl)
  return z.array(dryRunRowSchema).parse(res)
}
