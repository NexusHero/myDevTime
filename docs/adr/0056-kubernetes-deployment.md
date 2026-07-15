# ADR 0056: Kubernetes (k3s) deployment on Hetzner

## Status

Accepted (owner decision) — complements the CI/CD pipeline
([ADR-0016](0016-cicd-pipeline.md)) and the container-smoke artifact-parity gate
([ADR-0052](0052-container-smoke-test.md)); deploys the Docker images introduced
with [ADR-0049](0049-abandon-offline-first-architecture.md).

## Context

CI builds and smoke-tests the production images (`apps/api/Dockerfile`,
`apps/mobile/Dockerfile`) but nothing **runs** them anywhere. We need a hosted
target so the app is reachable, and a repeatable path from "merged to `main`" to
"live", without hand-rolled SSH-and-`docker run` steps.

Constraints and forces:

- **Small footprint / cost.** A single-node (or tiny) Hetzner box, not a managed
  control plane. [k3s](https://k3s.io/) fits: one binary, traefik + local-path
  storage built in.
- **Deploy-parity.** We already ship the same images CI smoke-tests (ADR-0052); the
  deployment must run *those* images, pinned to the exact commit, not a floating
  `:latest`.
- **Secret hygiene.** Nothing that would function as a real credential may live in
  git — the résumé claim is a codebase you could hand to a security reviewer.
- **Migrations before traffic.** The schema must be migrated with the image being
  deployed, before the new pods take requests (mirrors the compose stack's
  migrate-then-serve ordering).

## Decision

Add declarative manifests under [`k8s/`](../../k8s/) and a
`Deploy to Kubernetes` workflow ([`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml))
triggered on push to `main`:

- **Build & push** the api and web images to **GHCR**, tagged both `:latest` and
  `:sha-<7>` (`docker/metadata-action`). GHCR paths are lowercased from
  `${{ github.repository }}`.
- **Deploy** job: apply every non-secret manifest (idempotent bootstrap + converge),
  run the **migration Job on the freshly built SHA image** (`envsubst`), wait for it
  to complete, then `kubectl set image` both Deployments to that SHA and wait for the
  rollout.
- **Workloads:** api (2 replicas) and web (2 replicas) Deployments, a single-replica
  Postgres **StatefulSet** (10Gi PVC) with a headless Service, a Redis Deployment
  (ephemeral — it only backs the rate limiter, ADR-0050), and a **traefik Ingress**
  with cert-manager TLS.
- **Health:** readiness probes hit `/health/ready` (DB + Redis reachable, so a pod
  only takes traffic once its dependencies answer); liveness hits `/health`.
  Postgres/Redis use `pg_isready` / `redis-cli ping`.
- **Secrets** are created **out-of-band** against the cluster and never applied by
  the workflow; only `*.example.yaml` templates are tracked (`k8s/**/secret.yaml`
  is gitignored). `DATABASE_URL` is composed from the Postgres secret via kubelet
  `$(VAR)` interpolation, so the DB password appears in no manifest. See
  [`k8s/README.md`](../../k8s/README.md) for the bootstrap.

## Consequences

- **Pros:** one-push deploys of the exact images CI already validated; migrations
  run on the deployed revision before rollout; no plaintext credentials in the repo;
  probes reflect real dependency health; cheap single-node footprint.
- **Cons / limits:** single-node k3s is **not HA** — Postgres is one replica on a
  local PVC (backups/DR are a separate concern), and the box is a single point of
  failure. The migration Job assumes forward-only, backward-compatible migrations
  (no automated rollback). The cluster prerequisites (k3s, cert-manager +
  `letsencrypt-prod` issuer, the two Secrets) are manual one-time setup, documented
  but not codified. No `kubectl` validation runs in the local gate, so manifest
  changes rely on review + the live apply.
- **Reversible:** the manifests + one workflow are additive; deleting `k8s/` and
  `deploy.yml` removes the target with no effect on the app or the other CI tiers.
  A managed Postgres or a second node can replace the StatefulSet later without
  touching app code.
