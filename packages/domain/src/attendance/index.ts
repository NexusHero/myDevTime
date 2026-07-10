/**
 * The attendance work-day core (REQ-028, ADR-0010): punch-pair + overtime math
 * and the configurable break-rule check. Pure and deterministic (ADR-0005).
 */
export type { Shift, WeeklyTarget, OvertimeRange, OvertimeBalance } from './worktime.js'
export { isValidShift, shiftNetMs, targetForDay, computeOvertime } from './worktime.js'

export type { BreakRuleTier, BreakRulePreset } from './break-rule.js'
export { ARBZG_PRESET, requiredBreakMs, breakShortfallMs, hasBreakViolation } from './break-rule.js'
