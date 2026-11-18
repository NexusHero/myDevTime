# ADR-0079 — SonarCloud: analysis scope, unprivileged web edge, findings baseline

- **Status:** Accepted
- **Date:** 2026-11-18
- **Deciders:** NexusHero
- **Extends:** ADR-0078 (DevSecOps pipeline, #5 least-privilege pods). **Amends:** ADR-0049
  (the web image is no longer plain `nginx:alpine`). **Relates:** ADR-0005 (deterministic core).

## Context

SonarCloud automatic analysis (the `sonarqubecloud` GitHub app) reported 134 open issues on
`main`. Two thirds (66) sit in `docs/design-system/**` — the design-tool export the repo keeps
verbatim and already excludes from Prettier, ESLint and CodeQL — and 5 in an applied drizzle
migration (whole-table `UPDATE` backfills, intentional). The rest are real: quadratic regexes,
locale-dependent `sort()`, side effects inside React state updaters, a parser fuzz test without
an assertion, a non-TLS-enforcing SMTP transport, passwords inside Postgres URLs, a root nginx
edge that needed four Linux capabilities, missing k8s storage limits and service-account
opt-outs, and a world-writable DAST report directory.

## Decision

1. **Scope.** `.sonarcloud.properties` excludes exactly what CodeQL excludes, plus the drizzle
   migrations: `docs/design-system/**`, `apps/api/src/db/migrations/**`, `spikes/**`, `**/dist/**`.
   An applied migration is immutable (forward-only); a finding there is addressed by a new
   migration, never an edit.
2. **Deterministic ordering.** String sorts in product code use `compareStrings` from
   `@mydevtime/domain` — an ordinal (code-unit) comparator. `localeCompare` is rejected: it would
   make sort order, and every number derived from it, depend on the host's ICU locale (ADR-0005).
3. **Linear-time string helpers.** `stripTrailingSlashes` replaces `replace(/\/+$/, '')`; the docs
   diagram generator scans Mermaid blocks with `indexOf` instead of one backtracking regex.
4. **Unprivileged web edge.** The web image is `nginxinc/nginx-unprivileged:alpine` (uid 101,
   port 8080). The k8s pod runs `runAsNonRoot` with **all** capabilities dropped (no more
   `CHOWN/SETUID/SETGID/NET_BIND_SERVICE`); the Service keeps port 80 → targetPort 8080, compose
   publishes `8080:8080`.
5. **Pods.** Every workload sets `automountServiceAccountToken: false` (none calls the
   Kubernetes API) and declares `ephemeral-storage` requests/limits; the migrate Job gets
   CPU/memory requests/limits too.
6. **Credentials out of URLs.** Local/CI Postgres URLs carry no password; it travels in
   `PGPASSWORD`, which postgres.js reads. SMTP sends require TLS (`requireTLS`).

## Consequences

- Sonar's issue count reflects code we author; design-system findings are fixed upstream in the
  design tool, not in the export.
- Two `S4036` findings (`git`/`pnpm` resolved from `PATH` in dev-tooling scripts) remain by
  design — pinning absolute paths would break every non-default install; mark them *Accepted* in
  the Sonar UI.
- Anyone running the web image by hand must map container port **8080**, not 80.
