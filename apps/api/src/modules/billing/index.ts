import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { Config } from '../../config.js'
import type { Db } from '../../db/client.js'
import { moduleStatusRoute } from '../../core/module.js'
import { resolveWorkspaceId } from '../../core/workspace.js'
import type { RoundingIncrementMinutes } from '@mydevtime/domain'
import { UnauthorizedError } from '../../errors.js'
import * as svc from './service.js'
import { loadTimesheet } from './export/timesheet-source.js'
import { timesheetToCsv } from './export/csv.js'
import { timesheetToXlsx } from './export/xlsx.js'
import { timesheetToPdf } from './export/pdf.js'

export interface BillingModuleDeps {
  readonly db: Db | null
  readonly config: Config
}

const rateLevel = z.enum(['workspace', 'client', 'project', 'task'])
const rateSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  level: z.string(),
  scopeId: z.string().nullable(),
  amountMinorPerHour: z.number(),
  effectiveFrom: z.date(),
  createdAt: z.date(),
})
const budgetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  scope: z.string(),
  scopeId: z.string(),
  basis: z.string(),
  limitAmount: z.number(),
  period: z.string(),
  thresholds: z.array(z.number()),
  firedThresholds: z.array(z.number()),
  createdAt: z.date(),
  updatedAt: z.date(),
})
const statusSchema = z.object({
  consumed: z.number(),
  limit: z.number(),
  ratio: z.number(),
  remaining: z.number(),
  reached: z.array(z.number()),
})
const evaluationSchema = z.object({
  toFire: z.array(z.number()),
  toClear: z.array(z.number()),
  fired: z.array(z.number()),
})
const budgetStatusResponse = z.object({
  budget: budgetSchema,
  status: statusSchema,
  currencyCode: z.string(),
})
const budgetEvalResponse = budgetStatusResponse.extend({ evaluation: evaluationSchema })
const idParam = z.object({ id: z.uuid() })
const asOfQuery = z.object({ asOf: z.coerce.date().optional() })

/**
 * The `billing` module (ADR-0003/0006): the money layer at 1.0 — effective-dated
 * hourly rates, budgets, project cost, and budget threshold alerts (REQ-005).
 * Every route runs behind `requireAuth` and resolves the caller's workspace, so
 * money is workspace-isolated by construction. Without a DB only the status route
 * is mounted. (Payments/entitlements — Stripe & store IAP, ADR-0006 — are a
 * separate concern layered onto this module later.)
 */
export function billingModule(deps: BillingModuleDeps): FastifyPluginAsyncZod {
  return async app => {
    await app.register(moduleStatusRoute('billing'))
    const { db } = deps
    if (!db) return

    const workspaceOf = async (request: FastifyRequest): Promise<string> => {
      const authUser = request.authUser
      if (!authUser) throw new UnauthorizedError('Authentication required')
      return resolveWorkspaceId(db, authUser.id, authUser.name)
    }
    const guard = (instance: FastifyInstance): { preHandler: [typeof instance.requireAuth] } => ({
      preHandler: [instance.requireAuth],
    })

    // ── Rates ──────────────────────────────────────────────────────────────
    app.post(
      '/rates',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Add an effective-dated hourly rate',
          body: z.object({
            level: rateLevel,
            scopeId: z.uuid().nullish(),
            amountMinorPerHour: z.number().int().nonnegative(),
            effectiveFrom: z.coerce.date(),
          }),
          response: { 201: rateSchema },
        },
      },
      async (request, reply) => {
        const rate = await svc.createRate(db, await workspaceOf(request), request.body)
        return reply.code(201).send(rate)
      },
    )
    app.get(
      '/rates',
      { ...guard(app), schema: { tags: ['billing'], response: { 200: z.array(rateSchema) } } },
      async request => svc.listRates(db, await workspaceOf(request)),
    )
    app.delete(
      '/rates/:id',
      {
        ...guard(app),
        schema: { tags: ['billing'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteRate(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )

    // ── Budgets ────────────────────────────────────────────────────────────
    app.post(
      '/budgets',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Create a budget',
          body: z.object({
            scope: z.enum(['project', 'client']),
            scopeId: z.uuid(),
            basis: z.enum(['hours', 'money']),
            limitAmount: z.number().int().nonnegative(),
            period: z.enum(['total', 'monthlyRecurring']),
            thresholds: z.array(z.number().positive()).optional(),
          }),
          response: { 201: budgetSchema },
        },
      },
      async (request, reply) => {
        const budget = await svc.createBudget(db, await workspaceOf(request), request.body)
        return reply.code(201).send(budget)
      },
    )
    app.get(
      '/budgets',
      { ...guard(app), schema: { tags: ['billing'], response: { 200: z.array(budgetSchema) } } },
      async request => svc.listBudgets(db, await workspaceOf(request)),
    )
    app.get(
      '/budgets/:id',
      {
        ...guard(app),
        schema: { tags: ['billing'], params: idParam, response: { 200: budgetSchema } },
      },
      async request => svc.getBudget(db, await workspaceOf(request), request.params.id),
    )
    app.delete(
      '/budgets/:id',
      {
        ...guard(app),
        schema: { tags: ['billing'], params: idParam, response: { 204: z.null() } },
      },
      async (request, reply) => {
        await svc.deleteBudget(db, await workspaceOf(request), request.params.id)
        return reply.code(204).send(null)
      },
    )
    app.get(
      '/budgets/:id/status',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Budget consumption & thresholds reached (read-only)',
          params: idParam,
          querystring: asOfQuery,
          response: { 200: budgetStatusResponse },
        },
      },
      async (request): Promise<z.infer<typeof budgetStatusResponse>> => {
        const asOf = request.query.asOf ?? new Date()
        const out = await svc.budgetStatusFor(
          db,
          await workspaceOf(request),
          request.params.id,
          asOf,
        )
        return out as z.infer<typeof budgetStatusResponse>
      },
    )
    app.post(
      '/budgets/:id/evaluate',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Evaluate a budget; persist any newly crossed threshold alerts',
          params: idParam,
          querystring: asOfQuery,
          response: { 200: budgetEvalResponse },
        },
      },
      async (request): Promise<z.infer<typeof budgetEvalResponse>> => {
        const asOf = request.query.asOf ?? new Date()
        const out = await svc.evaluateBudget(
          db,
          await workspaceOf(request),
          request.params.id,
          asOf,
        )
        return out as z.infer<typeof budgetEvalResponse>
      },
    )

    // ── Cost ───────────────────────────────────────────────────────────────
    app.get(
      '/projects/:id/cost',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Cost of a project’s tracked time to date',
          params: idParam,
          querystring: asOfQuery,
          response: {
            200: z.object({
              costMinor: z.number(),
              currencyCode: z.string(),
              entryCount: z.number(),
            }),
          },
        },
      },
      async request => {
        const asOf = request.query.asOf ?? new Date()
        return svc.projectCost(db, await workspaceOf(request), request.params.id, asOf)
      },
    )

    // ── Timesheet export (CSV / XLSX / PDF) ──────────────────────────────────
    const exportQuery = z.object({
      format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      groupBy: z.enum(['entry', 'day', 'project', 'task']).default('entry'),
      roundingMode: z.enum(['none', 'nearest', 'up']).default('none'),
      roundingIncrement: z.coerce
        .number()
        .refine(n => [1, 5, 6, 15, 30, 60].includes(n), 'unsupported rounding increment')
        .default(1),
      billableOnly: z.coerce.boolean().default(false),
      locale: z.enum(['en', 'de']).default('en'),
      asOf: z.coerce.date().optional(),
    })
    app.get(
      '/projects/:id/timesheet',
      {
        ...guard(app),
        schema: {
          tags: ['billing'],
          summary: 'Export a project timesheet (CSV, XLSX or PDF)',
          params: idParam,
          querystring: exportQuery,
        },
      },
      async (request, reply) => {
        const q = request.query
        const { timesheet, meta } = await loadTimesheet(db, await workspaceOf(request), {
          projectId: request.params.id,
          from: q.from,
          to: q.to,
          groupBy: q.groupBy,
          rounding: {
            mode: q.roundingMode,
            incrementMinutes: q.roundingIncrement as RoundingIncrementMinutes,
          },
          billableOnly: q.billableOnly,
          asOf: q.asOf ?? new Date(),
        })
        const base = `timesheet-${meta.projectName}`.replace(/[^\w.-]+/g, '_')
        if (q.format === 'xlsx') {
          const buffer = await timesheetToXlsx(timesheet, meta)
          return reply
            .header('content-disposition', `attachment; filename="${base}.xlsx"`)
            .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .send(buffer)
        }
        if (q.format === 'pdf') {
          const buffer = await timesheetToPdf(timesheet, meta, q.locale)
          return reply
            .header('content-disposition', `attachment; filename="${base}.pdf"`)
            .type('application/pdf')
            .send(buffer)
        }
        return reply
          .header('content-disposition', `attachment; filename="${base}.csv"`)
          .type('text/csv; charset=utf-8')
          .send(timesheetToCsv(timesheet, meta))
      },
    )
  }
}
