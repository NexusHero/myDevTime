/** The modular-monolith boundaries from ADR-0003 (carried into the NestJS
 * structure, ADR-0025): each name is a feature module mounted under
 * `/api/<name>`. The boundary test uses this list to enforce that a module
 * imports only another module's public surface (`contract.ts` + `<name>.module.ts`). */
export const MODULE_NAMES = [
  'auth',
  'tracking',
  'sync',
  'automation',
  'ai',
  'billing',
  'worktime',
  'absences',
] as const
export type ModuleName = (typeof MODULE_NAMES)[number]
