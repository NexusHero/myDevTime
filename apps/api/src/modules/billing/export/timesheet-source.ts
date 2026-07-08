import { and, eq, gte, isNull, lt } from 'drizzle-orm'
import {
  buildTimesheet,
  entryDuration,
  resolveRate,
  type RateLevel,
  type RateRule,
  type RoundingRule,
  type Timesheet,
  type TimesheetEntryInput,
  type TimesheetGroupBy,
} from '@mydevtime/domain'
import type { Db } from '../../../db/client.js'
import { clients, projects, rates, tasks, timeEntries, workspaces } from '../../../db/schema.js'
import { NotFoundError } from '../../../errors.js'
import { isoDate } from './format.js'

/**
 * Assemble a `Timesheet` (REQ-009) from the workspace's data: load a project's
 * entries in the selected window, price each with the rate in effect at its own
 * start (task → project → client → workspace precedence, effective-dated), and
 * feed the deterministic `buildTimesheet`. Every serializer renders *this* — so
 * their totals are equal by construction. Workspace-scoped throughout.
 */

export interface TimesheetSelection {
  readonly projectId: string
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly groupBy: TimesheetGroupBy
  readonly rounding: RoundingRule
  readonly billableOnly: boolean
  readonly asOf: Date
}

export interface TimesheetMeta {
  readonly workspaceName: string
  readonly projectName: string
  readonly clientName: string | null
  readonly from: Date | null
  readonly to: Date | null
  readonly groupBy: TimesheetGroupBy
}

export interface LoadedTimesheet {
  readonly timesheet: Timesheet
  readonly meta: TimesheetMeta
}

function one<T>(rows: readonly T[], entity: string): T {
  const row = rows[0]
  if (!row) throw new NotFoundError(`${entity} not found`)
  return row
}

export async function loadTimesheet(
  db: Db,
  workspaceId: string,
  selection: TimesheetSelection,
): Promise<LoadedTimesheet> {
  const workspace = one(
    await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)),
    'workspace',
  )
  const project = one(
    await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.id, selection.projectId),
          isNull(projects.deletedAt),
        ),
      ),
    'project',
  )
  const client = project.clientId
    ? ((
        await db
          .select({ name: clients.name })
          .from(clients)
          .where(and(eq(clients.workspaceId, workspaceId), eq(clients.id, project.clientId)))
      )[0]?.name ?? null)
    : null

  // All rates for the workspace; filtered to each entry's chain below.
  const rawRates = await db.select().from(rates).where(eq(rates.workspaceId, workspaceId))
  const taskNames = new Map(
    (
      await db
        .select({ id: tasks.id, name: tasks.name })
        .from(tasks)
        .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.projectId, selection.projectId)))
    ).map(t => [t.id, t.name]),
  )

  const bounds = [
    eq(timeEntries.workspaceId, workspaceId),
    eq(timeEntries.projectId, selection.projectId),
    isNull(timeEntries.deletedAt),
  ]
  if (selection.from) bounds.push(gte(timeEntries.startedAt, selection.from))
  if (selection.to) bounds.push(lt(timeEntries.startedAt, selection.to))
  const entries = await db
    .select()
    .from(timeEntries)
    .where(and(...bounds))
    .orderBy(timeEntries.startedAt)

  const asOfMs = selection.asOf.getTime()
  const inputs: TimesheetEntryInput[] = entries.map(e => {
    const startMs = e.startedAt.getTime()
    const applicable: RateRule[] = rawRates
      .filter(
        r =>
          (r.level === 'workspace' && r.scopeId === null) ||
          (r.level === 'client' && r.scopeId === project.clientId) ||
          (r.level === 'project' && r.scopeId === selection.projectId) ||
          (r.level === 'task' && r.scopeId === e.taskId),
      )
      .map(r => ({
        level: r.level as RateLevel,
        amountMinorPerHour: r.amountMinorPerHour,
        effectiveFrom: r.effectiveFrom.getTime(),
      }))
    const rate = resolveRate(applicable, startMs)
    const durationMs = entryDuration(
      {
        id: e.id,
        start: startMs,
        end: e.endedAt ? e.endedAt.getTime() : null,
        billable: e.billable,
        source: e.source,
      },
      asOfMs,
    )
    const group = groupOf(selection.groupBy, e, project.name, taskNames)
    return {
      durationMs,
      rateMinorPerHour: rate?.amountMinorPerHour ?? 0,
      billable: e.billable,
      groupKey: group.key,
      groupLabel: group.label,
      ...(e.note !== null ? { note: e.note } : {}),
    }
  })

  const timesheet = buildTimesheet(inputs, {
    rounding: selection.rounding,
    currency: workspace.currencyCode,
    billableOnly: selection.billableOnly,
  })

  return {
    timesheet,
    meta: {
      workspaceName: workspace.name,
      projectName: project.name,
      clientName: client,
      from: selection.from ?? null,
      to: selection.to ?? null,
      groupBy: selection.groupBy,
    },
  }
}

interface Group {
  key: string
  label: string
}

function groupOf(
  groupBy: TimesheetGroupBy,
  entry: typeof timeEntries.$inferSelect,
  projectName: string,
  taskNames: Map<string, string>,
): Group {
  switch (groupBy) {
    case 'entry':
      return { key: entry.id, label: isoDate(entry.startedAt) }
    case 'day': {
      const day = isoDate(entry.startedAt)
      return { key: day, label: day }
    }
    case 'project':
      return { key: entry.projectId ?? 'none', label: projectName }
    case 'task':
      return {
        key: entry.taskId ?? 'no-task',
        label: entry.taskId ? (taskNames.get(entry.taskId) ?? 'Unknown task') : 'No task',
      }
  }
}
