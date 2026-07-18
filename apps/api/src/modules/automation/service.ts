import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  dryRun,
  type DryRunRow,
  type Rule,
  type RuleAction,
  type RuleMatcher,
  type RuleSubject,
} from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { rules } from '../../db/schema.js'
import { NotFoundError } from '../../errors.js'

/**
 * The `automation` rules service (REQ-011, ADR-0005). Pure persistence around the stored
 * `matcher → action` rules; **all** evaluation is the deterministic `packages/domain/rules`
 * engine — the service never decides a match itself, and dry-run writes nothing. Every function
 * takes a `workspaceId` non-optionally and filters by it, so rules are workspace-isolated by
 * construction (ADR-0015).
 */
export type RuleRow = typeof rules.$inferSelect

/** The matcher/action as they arrive from the validated DTO (optional fields may be `undefined`). */
interface LooseMatcher {
  readonly noteContains?: string | undefined
  readonly sourceIs?: string | undefined
  readonly projectIsEmpty?: boolean | undefined
  readonly startWithin?: { readonly fromMin: number; readonly toMin: number } | undefined
  readonly weekdayIn?: readonly number[] | undefined
}
interface LooseAction {
  readonly setProjectId?: string | undefined
  readonly setTaskId?: string | undefined
  readonly addTags?: readonly string[] | undefined
  readonly setBillable?: boolean | undefined
}

interface RuleInput {
  readonly order?: number | undefined
  readonly matcher?: LooseMatcher | undefined
  readonly action?: LooseAction | undefined
  readonly enabled?: boolean | undefined
}

/** Strip `undefined`-valued keys so the stored matcher is a clean, exact-optional `RuleMatcher`. */
function normalizeMatcher(m: LooseMatcher): RuleMatcher {
  const out: {
    noteContains?: string
    sourceIs?: string
    projectIsEmpty?: boolean
    startWithin?: { fromMin: number; toMin: number }
    weekdayIn?: readonly number[]
  } = {}
  if (m.noteContains !== undefined) out.noteContains = m.noteContains
  if (m.sourceIs !== undefined) out.sourceIs = m.sourceIs
  if (m.projectIsEmpty !== undefined) out.projectIsEmpty = m.projectIsEmpty
  if (m.startWithin !== undefined) out.startWithin = m.startWithin
  if (m.weekdayIn !== undefined) out.weekdayIn = m.weekdayIn
  return out
}

/** Strip `undefined`-valued keys so the stored action is a clean, exact-optional `RuleAction`. */
function normalizeAction(a: LooseAction): RuleAction {
  const out: {
    setProjectId?: string
    setTaskId?: string
    addTags?: readonly string[]
    setBillable?: boolean
  } = {}
  if (a.setProjectId !== undefined) out.setProjectId = a.setProjectId
  if (a.setTaskId !== undefined) out.setTaskId = a.setTaskId
  if (a.addTags !== undefined) out.addTags = a.addTags
  if (a.setBillable !== undefined) out.setBillable = a.setBillable
  return out
}

/** The dry-run subject as it arrives from the validated DTO (optional fields may be `undefined`). */
interface DryRunSubjectInput {
  readonly key: string
  readonly subject: {
    readonly note?: string | undefined
    readonly projectId?: string | null | undefined
    readonly source?: string | undefined
    readonly startMin?: number | undefined
    readonly weekday?: number | undefined
  }
}

/** Build a clean `RuleSubject` (exact-optional) from the DTO subject — set only defined fields. */
function normalizeSubject(s: DryRunSubjectInput['subject']): RuleSubject {
  const out: {
    note?: string
    projectId?: string | null
    source?: string
    startMin?: number
    weekday?: number
  } = {}
  if (s.note !== undefined) out.note = s.note
  if (s.projectId !== undefined) out.projectId = s.projectId
  if (s.source !== undefined) out.source = s.source
  if (s.startMin !== undefined) out.startMin = s.startMin
  if (s.weekday !== undefined) out.weekday = s.weekday
  return out
}

function one<T>(rows: readonly T[], entity: string): T {
  const row = rows[0]
  if (!row) throw new NotFoundError(`${entity} not found`)
  return row
}

export async function createRule(db: Db, workspaceId: string, input: RuleInput): Promise<RuleRow> {
  const rows = await db
    .insert(rules)
    .values({
      workspaceId,
      order: input.order ?? 0,
      matcher: normalizeMatcher(input.matcher ?? {}),
      action: normalizeAction(input.action ?? {}),
      enabled: input.enabled ?? true,
    })
    .returning()
  return one(rows, 'rule')
}

export function listRules(db: Db, workspaceId: string): Promise<RuleRow[]> {
  return db
    .select()
    .from(rules)
    .where(and(eq(rules.workspaceId, workspaceId), isNull(rules.deletedAt)))
    .orderBy(asc(rules.order), asc(rules.id))
}

export async function getRule(db: Db, workspaceId: string, id: string): Promise<RuleRow> {
  const rows = await db
    .select()
    .from(rules)
    .where(and(eq(rules.workspaceId, workspaceId), eq(rules.id, id), isNull(rules.deletedAt)))
  return one(rows, 'rule')
}

export async function updateRule(
  db: Db,
  workspaceId: string,
  id: string,
  patch: RuleInput,
): Promise<RuleRow> {
  // Read first so the version bump pins the exact prior logic (`rule:id@version`).
  const current = await getRule(db, workspaceId, id)
  const values: Partial<typeof rules.$inferInsert> = {
    updatedAt: new Date(),
    version: current.version + 1,
  }
  if (patch.order !== undefined) values.order = patch.order
  if (patch.matcher !== undefined) values.matcher = normalizeMatcher(patch.matcher)
  if (patch.action !== undefined) values.action = normalizeAction(patch.action)
  if (patch.enabled !== undefined) values.enabled = patch.enabled
  const rows = await db
    .update(rules)
    .set(values)
    .where(and(eq(rules.workspaceId, workspaceId), eq(rules.id, id), isNull(rules.deletedAt)))
    .returning()
  return one(rows, 'rule')
}

export async function deleteRule(db: Db, workspaceId: string, id: string): Promise<void> {
  const rows = await db
    .update(rules)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(rules.workspaceId, workspaceId), eq(rules.id, id), isNull(rules.deletedAt)))
    .returning({ id: rules.id })
  one(rows, 'rule')
}

/** Shape a stored row into the pure engine's `Rule` (the JSON columns are already its types). */
function toDomainRule(row: RuleRow): Rule {
  return {
    id: row.id,
    version: row.version,
    order: row.order,
    matcher: row.matcher,
    action: row.action,
    enabled: row.enabled,
  }
}

/**
 * Preview the workspace's rule set over the given subjects **without applying anything** — the
 * dry-run the user reviews before committing (REQ-011). All evaluation is the deterministic
 * `dryRun` core (ADR-0005); nothing is written.
 */
export async function dryRunRules(
  db: Db,
  workspaceId: string,
  subjects: readonly DryRunSubjectInput[],
): Promise<DryRunRow<string>[]> {
  const stored = await listRules(db, workspaceId)
  const normalized = subjects.map(s => ({ key: s.key, subject: normalizeSubject(s.subject) }))
  return dryRun(normalized, stored.map(toDomainRule))
}
