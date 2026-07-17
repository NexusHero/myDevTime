import { createContext, useContext, useMemo, useState } from 'react'
import {
  isModuleVisible,
  visibleModules,
  type UserRole,
  type VisibilityModule,
} from '@mydevtime/domain'

/**
 * Role & tier visibility for the client (REQ-056, design v14 §R). Role is a **visibility
 * preset**, not the paywall: the onboarding question / Profile switch picks which modules a
 * person sees, and this context runs that choice through the deterministic `visibleModules`
 * resolver (ADR-0005) so every screen asks one place. The **paywall** stays with the
 * entitlement `can()` — here `hasPro` is the preset-layer assumption (true), so what a user
 * sees is driven by their role, while the real Pro gate is enforced separately.
 *
 * The role is session-scoped for now; persisting it (a `role` preference) is the deferred
 * backend slice in ADR-0066. Default `both` reveals the full superset until a role is chosen,
 * so nothing is hidden by surprise.
 */
export interface RoleValue {
  readonly role: UserRole
  readonly setRole: (role: UserRole) => void
  /** Whether a module is visible under the current role (via the domain resolver). */
  readonly isVisible: (module: VisibilityModule) => boolean
  readonly modules: readonly VisibilityModule[]
}

const RoleContext = createContext<RoleValue | null>(null)

export interface RoleProviderProps {
  readonly children: React.ReactNode
  /** Initial role (default `both` = the full superset). */
  readonly initialRole?: UserRole
  /** Preset-layer Pro assumption (the real paywall is `can()`); defaults to true. */
  readonly hasPro?: boolean
  /** Whether the Family add-on is held (§F). */
  readonly hasFamilyAddOn?: boolean
}

export function RoleProvider({
  children,
  initialRole = 'both',
  hasPro = true,
  hasFamilyAddOn = false,
}: RoleProviderProps): React.JSX.Element {
  const [role, setRole] = useState<UserRole>(initialRole)
  const value = useMemo<RoleValue>(() => {
    const ctx = { role, hasPro, hasFamilyAddOn }
    return {
      role,
      setRole,
      isVisible: (module: VisibilityModule) => isModuleVisible(module, ctx),
      modules: visibleModules(ctx),
    }
  }, [role, hasPro, hasFamilyAddOn])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

/**
 * The fallback when a component renders outside a `RoleProvider` (e.g. an isolated screen
 * test): no role preset is applied, so the full superset shows (except the Family add-on).
 * `setRole` is a no-op — there is nothing holding the state.
 */
const DEFAULT_VALUE: RoleValue = {
  role: 'both',
  setRole: () => {},
  isVisible: module =>
    isModuleVisible(module, { role: 'both', hasPro: true, hasFamilyAddOn: false }),
  modules: visibleModules({ role: 'both', hasPro: true, hasFamilyAddOn: false }),
}

export function useVisibility(): RoleValue {
  return useContext(RoleContext) ?? DEFAULT_VALUE
}
