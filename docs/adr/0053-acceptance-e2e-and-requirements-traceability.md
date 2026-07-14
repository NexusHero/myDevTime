# ADR 0053: Browser acceptance tests + machine-checked requirements traceability

## Status

Accepted (owner decision) — extends the container-smoke tier
([ADR-0052](0052-container-smoke-test.md)) with the seeded login + round-trip
journey it deferred, and complements the testing strategy
([ADR-0027](0027-mobile-ui-testing-strategy.md)) and the E2E requirement
(REQ-022, [#27](https://github.com/NexusHero/myDevTime/issues/27)). Exercises the
Docker artifacts from [ADR-0049](0049-abandon-offline-first-architecture.md).

## Context

Two questions were open after ADR-0052:

1. **"Does the app actually come up and can I log in?"** The container-smoke tier
   proves the images boot and the edge path answers (health, nginx-served SPA,
   `nginx → api → guard` 401), but it never drives the **built UI in a browser**.
   Nobody wants to click through sign-in by hand every time to know the shell
   mounts, the login screen renders, and a real session gets a user past the auth
   gate. ADR-0052 explicitly left "a seeded login + round-trip journey" for later.
2. **"Is every requirement actually tested?"** The Requirements Register
   (`docs/architecture.md` §1, REQ-001…REQ-041) says _what_ must exist, but there
   was no enforced link from a requirement to the tests that verify it. A
   requirement could be marked Done while its tests were renamed away, or a new
   REQ could land with no verification story at all — and CI would stay green.

Two forces shape the acceptance tier specifically:

- **Auth is the gatekeeper.** The `LoginScreen` is sign-in only, and Better-Auth
  requires a verified email before a password sign-in succeeds. A browser test
  therefore can't create-and-log-in against the production config without a
  mailbox. Turning verification off globally would weaken production.
- **Parity vs. cost.** Driving a real browser against the full Docker stack is the
  slowest, most failure-prone tier. It must not tax every PR.

## Decision

### 1. A fourth CI tier — browser acceptance (`e2e/`)

A Playwright project **outside the pnpm workspace** (like `spikes/`) drives the
built web app through Chromium against the running `docker compose` stack. The
first journeys are the ones the owner asked for and nothing more: the app
**mounts** and renders the sign-in screen (REQ-002/007), a **seeded user signs
in** and reaches the app past the auth gate (REQ-007), and a **wrong password is
rejected** (REQ-007). Tests seed a fresh unique user through the Better-Auth
sign-up API, then sign in through the **real UI** — same origin as the app, so
session cookies work without CORS.

**Env-gated email verification.** `AUTH_REQUIRE_EMAIL_VERIFICATION` is now a
config flag (default `true`). A production refine **forbids turning it off when
`NODE_ENV=production`**, so the escape hatch cannot weaken a real deployment. The
E2E overlay (`docker-compose.e2e.yml`) sets it `false` in the compose-default
`NODE_ENV=development`, letting a seeded account sign in immediately.

**Trigger policy** (parity without taxing every PR): push to `main`,
`workflow_dispatch`, and PRs touching the app / auth-config / container-edge /
E2E surface. Ordinary docs-only PRs stay on the fast tiers.

### 2. Machine-checked requirements traceability

`docs/testing/requirements-traceability.md` maps **every** register requirement to
the automated tests that verify it, with an honest coverage state
(**Verified** / **Partial** / **Planned**). `scripts/check-req-coverage.mjs` (wired
into `./test.sh`, so it _is_ CI) enforces, deterministically and without a network:

- every `REQ-NNN` in the register has a row in the matrix (no silent coverage gap),
- every test path a row names exists on disk (no dead reference — tests can't be
  renamed/deleted out from under a requirement),
- no matrix row references a REQ absent from the register (no orphan rows).

The gate asserts the _traceability_ is complete and current — not that a passing
test proves a requirement finished. That judgement stays with review and the
acceptance tier.

## Consequences

- **Pros**: answers "does it mount + can I log in?" automatically, in a real
  browser, against the shipped images — no manual click-through. The same
  Dockerfiles/compose the owner runs locally (`make up` / `make e2e`) are what CI
  runs. The traceability gate makes "every requirement is tested" a checked fact,
  and adding a REQ now forces declaring its verification story.
- **Cons / limits**: the browser tier is the slowest and most flake-prone —
  mitigated by narrow triggers, a single Chromium project, and one retry in CI.
  The acceptance set is intentionally thin (mount + auth) to start; deeper golden
  paths (timer round-trip, invoicing) grow it under REQ-022. The env flag is a
  non-prod convenience guarded by a production refine; it is never a deploy knob.
  Mobile-platform E2E and the 20-consecutive-green flake gate (REQ-022) remain out
  of scope here.
- **Reversible**: an isolated `e2e/` project, one compose overlay, one workflow,
  one doc, and one check script. Removing them drops the tier and the gate with no
  effect on the app or the other jobs.
