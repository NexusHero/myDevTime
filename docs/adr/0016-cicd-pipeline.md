# ADR 0016: CI/CD Pipeline — Résumé-style Multi-Workflow Setup

## Status

Accepted

## Context

The bootstrap (ADR-0014) gave us one CI workflow: the local gate mirrored in
`ci.yml`, plus a Postgres integration job (ADR-0015). The sibling project
**Résumé/myJob** — one of the two sources of the Ultimate Development Process
(ADR-0001) — runs a broader, battle-tested pipeline that operationalizes several
things our own SKILL already mandates but CI did not yet enforce:
secret/dependency scanning (SKILL §4), Conventional Commits for contributors
without the local hook (SKILL §5), and least-privilege, timeout-bounded jobs.
The owner asked to adopt that pipeline here. We mirror its **shape**, adapted to
our stack (pnpm workspaces vs. npm; Fastify-generated OpenAPI vs. its packaged
app; Mermaid vs. PlantUML).

## Decision

Adopt Résumé's multi-workflow layout, least-privilege `permissions: contents:
read` by default, per-job `timeout-minutes`, and newer action majors
(`checkout@v4`→ kept, actions pinned) — adapted:

- **`ci.yml`** — keep `gate` (format · lint · typecheck · tests · docs, +
  OpenAPI artifact) and `integration` (Postgres); **add a `commitlint` job** on
  PRs running `scripts/check-conventional-commits.sh` so the Conventional-Commit
  rule holds even without the installed git hook.
- **`security.yml`** — `pnpm audit --prod --audit-level high` + GitHub
  `dependency-review` on PRs (informational until the repo's Dependency Graph is
  on), on push/PR and a weekly schedule. Realizes the SKILL §4 scanning rule now
  rather than waiting for the security issue (#24).
- **`codeql.yml`** (+ `codeql/codeql-config.yml`) — CodeQL
  `javascript-typescript`, `security-and-quality` queries, `spikes/**` and build
  output ignored (we don't hand-author them).
- **`dependabot.yml`** — weekly npm (pnpm lockfile) + github-actions updates,
  grouped dev-deps, Conventional-Commit prefixes.
- **`release.yml`** — on a `v*` tag (or manual dispatch): run the gate, build all
  packages, emit the OpenAPI spec, and publish a GitHub Release with generated
  notes and the spec attached.
- **`pages.yml`** — publish a static Swagger-UI mirror of the generated OpenAPI
  to GitHub Pages (needs the one-time Settings → Pages → "GitHub Actions" step).
- **Supporting files** from the same setup: `SECURITY.md`, `.editorconfig`,
  `.nvmrc`, and issue templates (`bug_report`, `feature_request`, `config`).

Deliberately **not** adopted yet (no target in the repo): the Playwright **e2e**
job (arrives with the E2E suite, #27) and the **PlantUML docs render** (we use
Mermaid; our deterministic `check:docs` already covers link/ADR/diagram
freshness in the gate).

## Consequences

- Security scanning, dependency hygiene, and commit-message conformance are
  enforced in CI from now on — not deferred to #24, and not reliant on every
  contributor having run `pnpm install` to get the hooks.
- More workflows = more moving parts to keep current; Dependabot's
  `github-actions` updates keep the action versions from rotting.
- CodeQL and Dependency-Review need GitHub Advanced Security / Dependency Graph
  enabled in repo settings; where they aren't, the jobs are informational rather
  than blocking (documented in each workflow).
- Release and Pages assume one-time repo settings (tag protection, Pages source);
  both are inert until a tag is pushed / Pages is enabled, so they cost nothing
  until used.
- The pipeline is itself an artifact a future maintainer reads to understand "how
  do we ship" — hence this ADR alongside the workflows.
