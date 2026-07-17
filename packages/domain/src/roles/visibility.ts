/**
 * Role & tier visibility (REQ-056, design v14 §R) — pure and deterministic (ADR-0005).
 * A **role is a visibility preset over the existing modules, never a fork**: the onboarding
 * question "Wofür nutzt du DevTime?" (employee / freelancer / both) sets which modules a
 * person sees by default, and the Profile can toggle individual modules on or off. This is
 * *not* the paywall — that stays with `can(entitlement, feature)` — but the two hard tier
 * floors are enforced here so no client can leak past them:
 *
 * - **A Stempler (Free) never sees €, clients, rates or billing.** Money/AI modules require
 *   Pro; no preset and no user override can reveal them without it.
 * - **Health/Balance is visible in every tier and can never be paywalled or hidden** — it is
 *   the brand promise ("Gesundheit wird nie gepaywallt").
 * - **Family (§F partner/capacity sharing) is an orthogonal add-on**, visible only when held.
 */

/** The onboarding intent that sets the visibility preset. `both` = the freelancer superset. */
export type UserRole = 'employee' | 'freelancer' | 'both'

export type VisibilityModule =
  // Work-time story — every role, no Pro needed (the Stempler baseline).
  | 'punch_clock'
  | 'overtime'
  | 'absences'
  | 'timesheet_export'
  // Health & balance — every tier, never paywalled, never hidden.
  | 'health'
  // Money / AI — the freelancer superset; Pro-gated (a hard floor).
  | 'clients'
  | 'rates'
  | 'invoicing'
  | 'effective_rate'
  | 'travel'
  | 'ai'
  // Family (§F) — orthogonal add-on.
  | 'family'

export const ALL_MODULES: readonly VisibilityModule[] = [
  'punch_clock',
  'overtime',
  'absences',
  'timesheet_export',
  'health',
  'clients',
  'rates',
  'invoicing',
  'effective_rate',
  'travel',
  'ai',
  'family',
]

/** The work-time modules every role gets for free. */
const WORKTIME: ReadonlySet<VisibilityModule> = new Set([
  'punch_clock',
  'overtime',
  'absences',
  'timesheet_export',
])

/** Money/AI modules — the freelancer superset, hard-gated behind Pro. */
const MONEY: ReadonlySet<VisibilityModule> = new Set([
  'clients',
  'rates',
  'invoicing',
  'effective_rate',
  'travel',
  'ai',
])

export interface VisibilityContext {
  readonly role: UserRole
  /** Whether the account currently holds Pro (the money/AI paywall floor). */
  readonly hasPro: boolean
  /** Whether the orthogonal Family add-on is held (§F). */
  readonly hasFamilyAddOn: boolean
  /** Explicit per-module user toggles (Profile → modules on/off), within the floors below. */
  readonly overrides?: Partial<Record<VisibilityModule, boolean>>
}

/** The preset default (before user overrides) for a module the floors already allow. */
function presetDefault(mod: VisibilityModule, ctx: VisibilityContext): boolean {
  if (mod === 'health' || WORKTIME.has(mod)) return true
  if (mod === 'family') return ctx.hasFamilyAddOn
  // Money/AI: revealed by preset only for the freelancer-leaning roles.
  return ctx.role !== 'employee'
}

/**
 * Whether a module is visible for a context. Hard floors are checked first and can never be
 * overridden: Health is always on; money/AI is off without Pro; Family is off without the
 * add-on. Only within those floors does an explicit user override, then the role preset, decide.
 */
export function isModuleVisible(mod: VisibilityModule, ctx: VisibilityContext): boolean {
  // Floors — never violated by a preset or an override.
  if (mod === 'health') return true
  if (MONEY.has(mod) && !ctx.hasPro) return false
  if (mod === 'family' && !ctx.hasFamilyAddOn) return false

  const override = ctx.overrides?.[mod]
  if (override !== undefined) return override
  return presetDefault(mod, ctx)
}

/** Every module visible for a context, in `ALL_MODULES` order. */
export function visibleModules(ctx: VisibilityContext): readonly VisibilityModule[] {
  return ALL_MODULES.filter(mod => isModuleVisible(mod, ctx))
}
