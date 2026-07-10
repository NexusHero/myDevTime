import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { wireDate } from '../../core/wire-schemas.js'

/**
 * Wire DTOs for the `billing` module (REQ-005/009/016, ADR-0025). Zod schemas
 * stay the single source (validated by the global `ZodValidationPipe`, fed to
 * OpenAPI via `nestjs-zod`); the deterministic money logic lives in
 * `packages/domain`, untouched.
 */

export class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}
export class AsOfQueryDto extends createZodDto(z.object({ asOf: wireDate.optional() })) {}
export class BillingSummaryQueryDto extends createZodDto(
  z.object({ from: wireDate, to: wireDate, asOf: wireDate.optional() }),
) {}

// ── Credit ledger (REQ-027) ─────────────────────────────────────────────────
export class LedgerQueryDto extends createZodDto(
  z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
) {}
export class UsageQueryDto extends createZodDto(z.object({ from: wireDate, to: wireDate })) {}
export class DebitDto extends createZodDto(
  z.object({
    amount: z.number().int().positive(),
    category: z.string().min(1),
    reason: z.string().min(1).nullish(),
    operationId: z.string().min(1).optional(),
  }),
) {}
export class GrantDto extends createZodDto(
  z.object({
    amount: z.number().int().positive(),
    kind: z.enum(['grant', 'topup']).optional(),
    category: z.string().min(1),
    reason: z.string().min(1).nullish(),
    operationId: z.string().min(1).optional(),
  }),
) {}

// ── Rates ─────────────────────────────────────────────────────────────────
export class CreateRateDto extends createZodDto(
  z.object({
    level: z.enum(['workspace', 'client', 'project', 'task']),
    scopeId: z.uuid().nullish(),
    amountMinorPerHour: z.number().int().nonnegative(),
    effectiveFrom: wireDate,
  }),
) {}

// ── Budgets ─────────────────────────────────────────────────────────────────
export class CreateBudgetDto extends createZodDto(
  z.object({
    scope: z.enum(['project', 'client']),
    scopeId: z.uuid(),
    basis: z.enum(['hours', 'money']),
    limitAmount: z.number().int().nonnegative(),
    period: z.enum(['total', 'monthlyRecurring']),
    thresholds: z.array(z.number().positive()).optional(),
  }),
) {}

// ── Timesheet export ─────────────────────────────────────────────────────────
export class ExportQueryDto extends createZodDto(
  z.object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    from: wireDate.optional(),
    to: wireDate.optional(),
    groupBy: z.enum(['entry', 'day', 'project', 'task']).default('entry'),
    roundingMode: z.enum(['none', 'nearest', 'up']).default('none'),
    roundingIncrement: z.coerce
      .number()
      .refine(n => [1, 5, 6, 15, 30, 60].includes(n), 'unsupported rounding increment')
      .default(1),
    billableOnly: z.coerce.boolean().default(false),
    locale: z.enum(['en', 'de']).default('en'),
    asOf: wireDate.optional(),
  }),
) {}

// ── Entitlements ─────────────────────────────────────────────────────────────
export class RecordEntitlementEventDto extends createZodDto(
  z.object({
    providerEventId: z.string().min(1),
    source: z.enum(['stripe', 'app_store', 'play', 'promo']),
    type: z.enum([
      'subscribed',
      'renewed',
      'payment_failed',
      'recovered',
      'canceled',
      'expired',
      'revoked',
      'promo_granted',
    ]),
    effectiveAt: wireDate,
    periodEnd: wireDate.nullish(),
    graceUntil: wireDate.nullish(),
  }),
) {}
