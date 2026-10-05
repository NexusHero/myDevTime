# ADR-0078 — DevSecOps pipeline: gated deploy, secrets, hardened workflows, signed images

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** NexusHero
- **Extends:** ADR-0016 (CI/CD pipeline), ADR-0052 (container smoke), ADR-0053 (E2E),
  ADR-0056 (Kubernetes deploy). **Relates:** REQ-019 (security hardening baseline),
  [`docs/security/hardening.md`](../security/hardening.md) §8.

## Context

ADR-0016 gave us scanning (CodeQL, a dependency gate, Dependabot) and ADR-0056 a push-to-`main`
rollout. Measured against a conventional DevSecOps pipeline — pre-commit, secrets, SAST, SCA,
build & test, DAST/fuzzing, SBOM & signing, gate & release — an audit of the repo on 2026-10-05
found:

1. **The deploy is not gated.** `deploy.yml` fires on the same push as CI, Security, CodeQL,
   container smoke and E2E, in parallel and independent of them. A commit whose tests or
   vulnerability scan fail is still built, pushed as `:latest` and rolled out. Every other gate
   is advisory as far as production is concerned.
2. **No secret scanning** — neither in CI nor in the pre-commit hook. (A full-history scan found
   no leaks, so there is nothing to rotate; there is also nothing that keeps it that way.)
3. **The workflows themselves are attack surface.** `zizmor` reports 40 high findings: every
   third-party action is referenced by a mutable tag, one `run:` block expands a
   pull-request-controlled value into shell, and the tag-triggered release restores a
   dependency cache an attacker-influenced run may have written.
4. **The shipped artifacts carry no evidence.** Images go to GHCR without a vulnerability scan,
   an SBOM, provenance or a signature, and the cluster pulls them by mutable tag. Releases ship
   no SBOM at all.
5. **No IaC scan.** The web image runs as root; the Kubernetes manifests set no
   `securityContext` (privilege escalation allowed, writable root filesystem).
6. **No dynamic testing** — no fuzzing of the code that parses untrusted input, no DAST.

## Decision

Close each gap with free, open-source tooling that runs in GitHub Actions, delivered as one
pull request per item (process skill §6) in this order:

| # | Stage | Decision |
|---|-------|----------|
| 1 | **Gate & release** | `deploy.yml` gains a `gate` job that waits until the workflows **CI, Security, CodeQL, Container smoke and Acceptance (E2E)** of *this push* are green (`scripts/wait-for-checks.mjs`, unit-tested). It waits on explicit **workflow names**, not job names or "all checks": job names collide (Pages also has `build`/`deploy`), and a commit also carries Dependabot and scheduled-scan runs that are not this push's verdict. A renamed workflow is never seen, so the gate times out red — it fails closed. Least-privilege `permissions` and a non-cancelling `concurrency` group on the deploy. |
| 2 | **Secrets** | `gitleaks` over the full history in CI (push, PR, weekly), with a reviewed `.gitleaks.toml` allowlist; the pre-commit hook scans staged changes when `gitleaks` is installed. |
| 3 | **Workflow hardening** | Every action pinned to a full commit SHA (Dependabot's `github-actions` ecosystem keeps the pins current), `persist-credentials: false` on checkouts, untrusted context passed via `env:` not template expansion, no cache in the release workflow, and `zizmor` as a CI gate over `.github/workflows`. |
| 4 | **Image supply chain** | In `deploy.yml`: build → **Trivy** image scan (HIGH/CRITICAL with a fix available breaks the build) → push with BuildKit **SBOM + `mode=max` provenance** attestations → **cosign keyless** signature (GitHub OIDC, no key to manage) → GitHub **build-provenance attestation** → roll out **by digest**, not by tag. |
| 5 | **IaC** | `trivy config` over the Dockerfiles and `k8s/` as a CI gate. Findings are fixed (non-root web image, restrictive `securityContext`s) or accepted in a commented `.trivyignore` with the reason — the same discipline as `osv-scanner.toml`. |
| 6 | **Release SBOM** | `release.yml` attaches a CycloneDX SBOM of the workspace to every GitHub Release, with a provenance attestation. |
| 7 | **Fuzzing** | Property-based fuzzing with `fast-check` of the code that parses untrusted input (free-text entry parsing, request validation), as ordinary Vitest tests inside `./test.sh` — no separate harness, no extra CI job. |
| 8 | **DAST** | OWASP ZAP baseline scan, nightly and on demand, against the same Docker stack the E2E job starts; it fails on rules marked `FAIL` in a reviewed rules file. Never against production. |

Three repository settings cannot be expressed in code and are recorded as one-time manual steps
in [`docs/security/devsecops.md`](../security/devsecops.md): branch protection on `main` with the
gate workflows as required checks, secret scanning with push protection, and the Dependency
Graph (which turns `dependency-review` from informational into a real gate).

## Consequences

- **Production follows the gates.** A red test, vulnerability, CodeQL finding, smoke or E2E
  failure now stops the rollout instead of being noticed afterwards. The price is latency: a
  deploy waits for the slowest required workflow (E2E, ~10–15 min) before it starts building.
- **Every shipped image is scanned, signed, attested and pinned by digest**, so "what exactly
  runs in the cluster, built from which commit, containing which packages" has a verifiable
  answer — the precondition for answering a vulnerability report within hours rather than days.
- More gates mean more ways for CI to go red for reasons outside the change (a new CVE in a base
  image). That is intended; the answer is a fix or a documented, revisited exception, never a
  disabled gate.
- **Not covered, deliberately** — these need an organisation, not a pipeline, and are recorded
  as such in `docs/security/devsecops.md` rather than faked: independent review (a second
  person), external penetration testing, certification audits (IEC 62443-4-1, ISO 27001), a
  staffed incident-response function, and 24/7 runtime monitoring.

## Alternatives considered

- **Deploy via `workflow_run` on CI.** Waits for one workflow only; Security, CodeQL and the
  acceptance tiers would still be bypassed. Rejected.
- **Wait for "every check run on the commit".** Tried first; the commit's real history showed
  it blocks on unrelated failures (the Pages job, Dependabot update runs, scheduled scans).
  Rejected in favour of explicit workflow names.
- **Commercial scanners (Snyk, Checkmarx, Veracode).** No capability this repo needs that the
  open-source set lacks; adds cost and a vendor account. Rejected.
