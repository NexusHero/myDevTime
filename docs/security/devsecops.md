# DevSecOps pipeline

**Decision:** [ADR-0078](../adr/0078-devsecops-pipeline.md) (extends ADR-0016) · **Requirement:** REQ-019

The standing map of how a change travels from a commit to the cluster, which gate checks what,
and — just as important — what this pipeline does **not** cover. Keep the status column honest:
a stage is ✅ only when it can actually stop a bad change.

## Stages

| # | Stage | Tooling | Where | Blocks | Status |
|---|-------|---------|-------|--------|--------|
| 1 | Pre-commit | staged secret scan (gitleaks, if installed) + full local gate (`./test.sh`) | `scripts/hooks/pre-commit` | the commit | ✅ |
| 2 | Secrets | gitleaks (default rules, [`.gitleaks.toml`](../../.gitleaks.toml)), full history; staged changes in the hook | `security.yml`, `scripts/hooks/pre-commit` | PR, deploy, the commit (when installed locally) | ✅ |
| 3 | SAST | CodeQL `security-and-quality` | `codeql.yml` | PR, deploy | ✅ |
| 4 | SCA (dependencies) | OSV-Scanner over `pnpm-lock.yaml`; Dependabot; dependency review | `security.yml` | PR, deploy | ✅ (dependency review informational until the Dependency Graph is on) |
| 5 | Build & test | `./test.sh`, Postgres integration, container smoke, browser E2E | `ci.yml`, `container-smoke.yml`, `acceptance-e2e.yml` | PR, deploy | ✅ |
| 6 | Fuzzing / DAST | — | — | — | ⏳ planned (ADR-0078 #7, #8) |
| 7 | SBOM, signing, provenance | — | — | — | ⏳ planned (ADR-0078 #4, #6) |
| 8 | Gate & release | `gate` job waits for CI, Security, CodeQL, Container smoke, Acceptance (E2E) of the same push | `deploy.yml` + [`scripts/wait-for-checks.mjs`](../../scripts/wait-for-checks.mjs) | the rollout | ✅ |
| — | Workflow hardening | every action pinned to a commit SHA (Dependabot updates the pins), `persist-credentials: false`, untrusted context via `env:`, no cache in the release, `gh` instead of a third-party release action; `zizmor` audit (online: verifies the pinned SHAs) | all workflows; gate in `security.yml` | PR, deploy | ✅ |
| — | IaC (Dockerfiles, `k8s/`) | — | — | — | ⏳ planned (ADR-0078 #5) |

## How the deploy gate works

`deploy.yml` starts on every push to `main`, at the same moment as the quality and security
workflows. Its first job polls the GitHub Actions API for the workflow runs of **this commit,
triggered by this push**, and:

- **fails** the moment any required workflow concludes with anything but success / skipped /
  neutral — nothing is built or pushed;
- **waits** while a required workflow is queued, running, or not yet registered;
- **passes** only when all of them are green.

Required workflows are named explicitly (`--workflow …` in `deploy.yml`). Renaming one of them
without updating the list makes the gate wait until its timeout and fail — it fails closed. To
add a gate, add its workflow name there.

## One-time repository settings (manual — not expressible in code)

| Setting | Where | Why |
|---------|-------|-----|
| Branch protection on `main`: require PRs and the checks *Local gate*, *Integration (Postgres)*, *OSV vulnerability scan*, *Analyze (javascript-typescript)* | Settings → Branches | Stops a red change from reaching `main` at all; the deploy gate is the second line. |
| Secret scanning + push protection | Settings → Code security | GitHub blocks a push containing a known token format, before it is public. |
| Dependency Graph | Settings → Code security | Turns `dependency-review` from informational into a real gate. |

## What this pipeline deliberately does not cover

These need an organisation, budget or people — not a workflow file. They are listed so that no
one mistakes the pipeline for more than it is.

| Not covered | Why not | What stands in for it |
|-------------|---------|------------------------|
| Independent review (four-eyes, separation of developer / verifier / approver) | One maintainer | Automated gates + AI-assisted review — **not** independent in the sense of IEC 62443-4-1 or EN 50716 |
| External penetration test, bug bounty | Cost | Planned ZAP baseline + fuzzing find the shallow end only |
| Certification or audit (IEC 62443-4-1, ISO 27001, SOC 2) | Requires an accredited external body | This document + ADRs as the evidence trail an audit would start from |
| Staffed incident response / PSIRT, regulator reporting within 24 h | No on-call organisation | [`SECURITY.md`](../../SECURITY.md) disclosure process (best effort) |
| 24/7 runtime monitoring, SIEM, intrusion detection | Nobody to act on alerts | Rate limiting, structured logs, Kubernetes restarts |
| Mobile app penetration test on real devices | Cost, device lab | Static checks only |
| Bit-for-bit reproducible builds | Node/Expo toolchain is not deterministic | Pinned lockfile, pinned base images, provenance attestation (planned) |
