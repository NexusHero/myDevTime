/**
 * Public contract of the `worktime` module — attendance shifts + overtime balance (REQ-028, ADR-0010/0025).
 *
 * Other modules depend ONLY on this file, never on the module's internals; the
 * boundary test enforces it. The read seam exposed here is the day's worktime
 * feed — the deterministic overtime + break-shortfall numbers (ADR-0005) that the
 * Evening Companion sources for its wellbeing signals. Both reads are
 * workspace-scoped by construction; the underlying math stays in
 * `packages/domain/attendance`.
 */
export { listShifts, worktimeSummary } from './service.js'
export type { ShiftView, WorktimeQuery } from './service.js'
