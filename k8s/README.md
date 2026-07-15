# Kubernetes deployment (k3s on Hetzner)

Manifests for running myDevTime on a small [k3s](https://k3s.io/) cluster, plus a
GitHub Actions workflow ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml))
that builds the production images, pushes them to GHCR, runs migrations, and rolls
out the new revision on every push to `main`. See
[ADR-0056](../docs/adr/0056-kubernetes-deployment.md) for the decision and its
trade-offs.

## Layout

| Path | What |
|------|------|
| `postgres/` | StatefulSet (10Gi PVC) + headless Service + secret template |
| `redis/` | Deployment (ephemeral) + Service |
| `api/` | Deployment + Service + one-off migration Job + secret template |
| `web/` | Deployment (nginx serving the exported SPA) + Service |
| `ingress.yaml` | traefik Ingress with cert-manager TLS for `mydevtime.com` |

## Secrets are managed out-of-band

Only the `*.example.yaml` templates are tracked. **No real credential is committed
to git**, and the deploy workflow never applies a Secret manifest — so a template
can never overwrite a live secret. Create the two Secrets once, directly against
the cluster:

```sh
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=mydevtime \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=POSTGRES_DB=mydevtime

kubectl create secret generic api-secrets \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 48)" \
  --from-literal=AUTH_BASE_URL=https://mydevtime.com \
  --from-literal=TRUSTED_ORIGINS=https://mydevtime.com
```

`DATABASE_URL` is **not** stored anywhere in plaintext: the api Deployment and the
migration Job compose it from `POSTGRES_PASSWORD` via kubelet `$(VAR)` interpolation.

## First-time bootstrap

1. Point `kubectl` at the cluster and create the two Secrets above.
2. Install [cert-manager](https://cert-manager.io/) and a `letsencrypt-prod`
   `ClusterIssuer` (referenced by `ingress.yaml`).
3. Push to `main` (or run the workflow manually). The `deploy` job is idempotent:
   it `kubectl apply`s every non-secret manifest, runs the migration Job on the
   freshly built image, then `kubectl set image` to the exact commit SHA and waits
   for the rollout.

## Notes

- Image names are derived from `${{ github.repository }}`, lowercased for GHCR
  (`ghcr.io/nexushero/mydevtime-{api,web}`). The manifests carry a `:latest`
  bootstrap tag; the workflow pins the deployed revision to `sha-<7>`.
- Readiness probes hit `/health/ready` (DB + Redis reachable); liveness hits
  `/health` (process up). Postgres/Redis use `pg_isready` / `redis-cli ping`.
- This is a separate concern from the CI container-smoke gate
  ([ADR-0052](../docs/adr/0052-container-smoke-test.md)), which exercises the same
  images via docker-compose before they are ever deployed.
