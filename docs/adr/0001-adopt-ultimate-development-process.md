# ADR 0001: Adopt the Ultimate Development Process

## Status

Accepted

## Context

myDevTime is a green-field project with no established development process yet. The sibling
project **Finanzo** already runs on the *Ultimate Development Process* — a governance model merged
from two earlier sibling projects (ElliotWaveAnalyzer, Résumé/myJob) that unifies architecture
governance (Requirements Register, MADR ADRs, sequence diagrams, Tech Radar), TDD/testing
discipline, SOLID-as-a-gate implementation style, and a Conventional-Commits/PR workflow into one
Definition of Done. Re-deriving a process ad hoc as this codebase grows would repeat exactly the
work that skill already consolidates.

## Decision

Adopt the vendor-neutral, stack-agnostic
[`skills/ultimate-dev-process/SKILL.md`](../../skills/ultimate-dev-process/SKILL.md) — copied
verbatim from Finanzo — as this project's governance model from day one.

## Consequences

- Every feature from the start carries a `REQ-NNN` id in the Requirements Register
  (`docs/architecture.md` §1) and, once fulfilled, a sequence diagram — there is no legacy backlog
  of undocumented decisions to retrofit.
- Technology choices are ADRs from the very first line of code: the backend stack (ADR-0003), the
  client stack (ADR-0004), the AI layer (ADR-0005), billing (ADR-0006), and auth (ADR-0007) are
  all recorded in this same initial batch.
- The **Appendix: Stack Adaptation** table in the skill stays a placeholder until the repo is
  bootstrapped; CI cannot yet enforce the local-gate script or the coverage gate. This is
  intentional — documenting the rule now is cheaper than exempting early code from it later.
- The skill file is a copy, not a submodule: improvements made here or in Finanzo must be ported
  by hand. Accepted for now — the file changes rarely, and a shared-skill repo can be extracted
  later if drift becomes a real problem.
