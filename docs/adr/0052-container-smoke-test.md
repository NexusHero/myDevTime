# ADR 0052: Container smoke test in CI (artifact-parity gate)

## Status

Accepted (owner decision) — complements the CI pipeline
([ADR-0016](0016-cicd-pipeline.md)) and the testing strategy
([ADR-0027](0027-mobile-ui-testing-strategy.md)); exercises the Docker artifacts
introduced with [ADR-0049](0049-abandon-offline-first-architecture.md).

## Context

CI already has two tiers: the **local gate** (`./test.sh` — format, lint,
typecheck, unit tests + coverage, docs) and an **integration** job that boots the
real NestJS app *in-process* against a real Postgres **service container** and
drives it via `app.inject()`. That covers the production **code paths** and the
database, but it never exercises the thing we actually ship: the **built Docker
images**. Bugs that only appear in the image — a missing file after
`pnpm deploy --prod`, migrate-on-boot failing, the `nginx` `/api` proxy,
`TRUST_PROXY`/`X-Forwarded` handling, the Redis wiring, the exported web bundle —
pass every in-process test and still break a deploy.

The forces:

- **Parity vs. cost.** Building the images and standing up the whole stack is
  slower and flakier (image builds, healthchecks, container networking) than
  vitest. Running it on every PR would tax iteration for a signal most PRs don't
  change.
- **Honesty.** The résumé claim is "we test what we ship." A green vitest run is
  not that; a black-box HTTP check against the running images is.

## Decision

Add a **third, narrow CI tier**: a `container-smoke` workflow that builds the
production images (`apps/api/Dockerfile`, `apps/mobile/Dockerfile`) via
`docker compose`, starts the full stack (Postgres · Redis · api · web/nginx), and
runs `scripts/container-smoke.sh` — black-box HTTP checks from the runner:

- `GET :3000/health/ready` → **200** — the api image booted, **migrate-on-boot**
  succeeded (the image `CMD` is `migrate && main`, so `main` only runs if the
  migration did), and the DB is reachable.
- `GET :3000/health` → **200** — liveness.
- `GET :8080/` → **200** — the web image's `nginx` serves the exported SPA.
- `GET :8080/api/billing/invoices` → **401** — the whole edge path
  (`nginx` → NestJS → auth guard) is live end to end.

A CI-only `docker-compose.ci.yml` overlay publishes the api's port so the
readiness probe (which `nginx` does not proxy) is reachable; the production
compose keeps the api unpublished (reachable only through `nginx`).

**Trigger policy** (parity without taxing every PR): the job runs on **push to
`main`**, on **`workflow_dispatch`**, and on **PRs that touch the container/edge
surface** (Dockerfiles, `nginx.conf`, either compose file, the smoke script, or
the workflow) — so a broken image/compose/proxy change is caught before it lands,
while ordinary feature PRs stay on the fast two-tier gate.

## Consequences

- **Pros**: catches image-only regressions (missing files, boot/migrate failures,
  proxy/header wiring, Redis) that the in-process tests can't; gives real
  deploy-parity confidence; the smoke script is runnable locally against
  `docker compose up`.
- **Cons / limits**: adds a slower, more failure-prone job (image builds, stack
  start, networking) — mitigated by narrow triggers + a Buildx layer cache. It
  runs the images in the compose default `NODE_ENV=development`; **production
  config validation** (required `AUTH_SECRET`, secure cookies, trusted origins) is
  **out of scope** here and stays a deploy concern. The smoke set is intentionally
  thin (health + edge reachability), not a full end-to-end auth/CRUD journey — a
  later step could add a seeded login + round-trip if the parity need grows.
- **Reversible**: it's an isolated workflow + one compose overlay + one script;
  deleting them removes the tier with no effect on the app or the other jobs.
