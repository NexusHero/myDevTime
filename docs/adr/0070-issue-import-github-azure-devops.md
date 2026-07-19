# ADR 0070: Ticket/issue import (GitHub Issues + Azure DevOps Work Items) behind one port — import proposes, the human books

## Status

Accepted (owner decision) — **bound by ADR-0005** (the import produces *proposals*; a task is
created only on explicit user confirm, never automatically), **ADR-0033** (least-privilege
connector consent + the sealed OAuth-token vault), and the ports-and-adapters rule (skill §2.2:
each vendor's JSON confined to one adapter file). Mirrors the calendar-sync vertical (ADR-0032/0033,
REQ-010/064) and the export vertical (REQ-035). Supersedes nothing.

## Context

Developers already track work that lives as **issues** in GitHub and **work items** in Azure
DevOps Boards. Re-typing those into myDevTime as tasks is friction. The connector registry already
lists GitHub with a read capability, but no adapter ever fetched issues, and Azure DevOps was not
modelled at all.

The risk in "pull tickets in" is the usual one: an integration that silently creates tasks,
duplicates them on every sync, or invents fields would corrupt the workspace and violate ADR-0005.

## Decision

An **issue-import** vertical built exactly like the other volatile-vendor integrations —
deterministic core → narrow port + confined adapters → preview that writes nothing → explicit
client confirm:

1. **Deterministic core** (`packages/domain/src/issueimport`, pure, tested to 100 % lines):
   `toTaskProposals(issues, alreadyImportedKeys, opts)` maps the neutral `ExternalIssue` to a
   `CandidateTaskProposal` (`provenance: import:github | import:azure-devops`, `confirmed: false`),
   **dedups** by `key` against already-imported keys and in-batch duplicates, filters `closed`
   issues unless asked, and orders deterministically (updated desc, key asc). No fabricated fields.
2. **One narrow port** (`IssueImportPort { provider; available(); listIssues({state}) }`) with a
   `NullIssueImport` graceful-degradation default and two live adapters, each confining its vendor
   JSON to a single file:
   - **GitHub**: `GET /issues?filter=assigned` with the vault's bearer token → `ExternalIssue`
     (`key = owner/repo#number`); pull requests and malformed items are skipped.
   - **Azure DevOps**: a two-step **WIQL** query (assigned to `@Me`, open-state filtered) → a
     work-item **batch** read (`System.Title/State/ChangedDate/AssignedTo`) → `ExternalIssue`
     (`key = project/id`). `ChangedDate` is read because the deterministic sort needs a real
     `updatedAtMs` — omitting it would make ordering meaningless.
3. **Registry**: `azure-devops` joins the connector registry (category `issues`, `auth:'oauth2'`,
   read-only `vso.work`; write only when outbound is granted, per ADR-0033), with its authorize +
   token endpoints; GitHub's token endpoint is added.
4. **Preview endpoint** `GET /api/connectors/:id/issues/preview` (behind the auth guard), gated
   exactly like the calendar preview — unknown/wrong connector → 404/409, no `inbound` consent → 409,
   no sealed token / unconfigured token flow → 409 — resolves the vault-backed live token and returns
   `{ proposals, status }`. It **writes nothing**. An unconfigured or unconsented deployment returns
   an honest 409 / `unavailable` — never a fake import.
5. **Client confirm**: the `IssueImportCard` (ProjectsScreen) previews the proposals, lets the user
   select, and creates a task per selection via the existing `POST /api/tracking/tasks`. The import
   proposes; the user books.

## Consequences

- **Safe by construction:** nothing is created without the user selecting and confirming; dedup +
  provenance keep imports idempotent-in-intent and traceable; env-gating keeps every vendor dormant
  and honest until configured.
- **Reuses the established seams:** the connector consent + sealed-token vault, the `:id/preview`
  gating, and the tracking task-create endpoint — no new auth or persistence surface invented.
- **Honest gaps (deferred, tracked in REQ-066):** there is no *imported-issue store* yet, so a
  re-preview re-proposes already-imported tickets (dedup runs against an empty set today); and the
  Azure DevOps OAuth grant uses a non-standard `response_type=Assertion` / JWT client-assertion shape
  that is registered but not exercised (the flow is env-gated and dormant). Neither is faked.
- **External handback:** a real GitHub OAuth app, and an Azure DevOps org/project + OAuth credentials
  (or a sealed PAT), before either goes live.
