/**
 * Issue/ticket import core (GitHub Issues + Azure DevOps Work Items → candidate tasks, ADR-0005) —
 * the pure, exhaustively-tested half of "connect a tracker, get its tickets as candidate tasks to
 * confirm". Adapters fetch tickets as neutral `ExternalIssue`s; `toTaskProposals` maps, filters,
 * dedups and orders them into `CandidateTaskProposal`s. It never creates — the human confirms.
 */
export type { IssueSource, ExternalIssue, CandidateTaskProposal, ImportOptions } from './issues.js'
export { toTaskProposals } from './issues.js'
