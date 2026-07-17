import { describe, expect, it } from 'vitest'
import {
  ALL_MODULES,
  isModuleVisible,
  visibleModules,
  type VisibilityContext,
  type VisibilityModule,
} from './visibility.js'

/**
 * Acceptance for the role/tier visibility resolver (REQ-056, design v14 §R). Role is a
 * *visibility preset* over the existing modules — never a fork. The non-negotiables:
 * a Stempler (Free) never sees €/clients/billing; Health/Balance is visible in **every**
 * tier and can never be paywalled or hidden; Family is an orthogonal add-on. Pure and
 * deterministic (ADR-0005) — the paywall floor is enforced here, not in a client compare.
 */
const stempler: VisibilityContext = { role: 'employee', hasPro: false, hasFamilyAddOn: false }
const freelancerPro: VisibilityContext = {
  role: 'freelancer',
  hasPro: true,
  hasFamilyAddOn: false,
}

const MONEY: readonly VisibilityModule[] = [
  'clients',
  'rates',
  'invoicing',
  'effective_rate',
  'travel',
  'ai',
]

describe('isModuleVisible — the §R guarantees', () => {
  it('Stempler_NeverSeesMoneyOrClientsOrBilling', () => {
    for (const mod of MONEY) {
      expect(isModuleVisible(mod, stempler), mod).toBe(false)
    }
  })

  it('Stempler_SeesTheWorkTimeStory', () => {
    for (const mod of ['punch_clock', 'overtime', 'absences', 'timesheet_export'] as const) {
      expect(isModuleVisible(mod, stempler), mod).toBe(true)
    }
  })

  it('Health_IsVisibleInEveryTier_NeverPaywalled', () => {
    const everyContext: VisibilityContext[] = [
      stempler,
      freelancerPro,
      { role: 'employee', hasPro: true, hasFamilyAddOn: true },
      { role: 'both', hasPro: false, hasFamilyAddOn: false },
    ]
    for (const ctx of everyContext) {
      expect(isModuleVisible('health', ctx)).toBe(true)
    }
  })

  it('FreelancerPro_SeesMoneyAndAi', () => {
    for (const mod of MONEY) {
      expect(isModuleVisible(mod, freelancerPro), mod).toBe(true)
    }
  })

  it('Family_IsVisibleOnlyWithTheAddOn', () => {
    expect(isModuleVisible('family', freelancerPro)).toBe(false)
    expect(isModuleVisible('family', { ...freelancerPro, hasFamilyAddOn: true })).toBe(true)
  })
})

describe('isModuleVisible — hard floors beat presets and overrides', () => {
  it('MoneyStaysHidden_EvenIfAnOverrideTriesToForceItOn_WithoutPro', () => {
    const ctx: VisibilityContext = { ...stempler, overrides: { invoicing: true, clients: true } }
    expect(isModuleVisible('invoicing', ctx)).toBe(false)
    expect(isModuleVisible('clients', ctx)).toBe(false)
  })

  it('Health_CannotBeHiddenByAnOverride', () => {
    const ctx: VisibilityContext = { ...stempler, overrides: { health: false } }
    expect(isModuleVisible('health', ctx)).toBe(true)
  })

  it('Family_CannotBeForcedOnWithoutTheAddOn', () => {
    const ctx: VisibilityContext = { ...freelancerPro, overrides: { family: true } }
    expect(isModuleVisible('family', ctx)).toBe(false)
  })

  it('AnOverrideCanHideAnOptionalModuleTheUserDoesNotWant', () => {
    // A freelancer who doesn't travel can switch the module off.
    expect(isModuleVisible('travel', { ...freelancerPro, overrides: { travel: false } })).toBe(
      false,
    )
    // An employee can hide absences they don't use.
    expect(isModuleVisible('absences', { ...stempler, overrides: { absences: false } })).toBe(false)
  })
})

describe('visibleModules', () => {
  it('StemplerSet_IsWorkTimePlusHealth_NoMoney', () => {
    const set = new Set(visibleModules(stempler))
    expect(set).toEqual(
      new Set(['punch_clock', 'overtime', 'absences', 'timesheet_export', 'health']),
    )
  })

  it('IsAlwaysASubsetOfAllModules', () => {
    for (const mod of visibleModules(freelancerPro)) {
      expect(ALL_MODULES).toContain(mod)
    }
  })

  it('BothRoleWithProAndFamily_SeesEverything', () => {
    const set = new Set(visibleModules({ role: 'both', hasPro: true, hasFamilyAddOn: true }))
    expect(set).toEqual(new Set(ALL_MODULES))
  })
})
