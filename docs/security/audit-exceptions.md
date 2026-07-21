# Dependency audit exceptions

The dependency-vulnerability CI gate ([`.github/workflows/security.yml`](../../.github/workflows/security.yml),
ADR-0016) runs **OSV-Scanner** over the pnpm lockfile. This file documents every
advisory we knowingly accept, so the allowlist is auditable and revisited — not a
silent suppression.

> **Why not `pnpm audit`?** In 2026-07 npm retired its audit endpoints (they now
> return HTTP 410, "use the bulk advisory endpoint"), which broke `pnpm audit`
> registry-wide. OSV-Scanner queries the OSV database directly from the lockfile,
> so it does not depend on the npm audit endpoint.

Configuration lives in the root [`package.json`](../../package.json) under
`pnpm.overrides` (fixes) and in [`osv-scanner.toml`](../../osv-scanner.toml)
(`[[IgnoredVulns]]`, accepted). The legacy `pnpm.auditConfig.ignoreGhsas` list is
kept in sync for anyone running `pnpm audit` locally, but CI reads
`osv-scanner.toml`.

## Fixed via override

| Package | Override | Why |
|---------|----------|-----|
| `@xmldom/xmldom` | `>=0.8.13` | Pulled in only by `expo > @expo/cli > @expo/plist` (iOS plist parsing in the Expo **build CLI**). A patch-level bump clears 5 high advisories with no runtime effect. |
| `tar` | `^7.5.19` | Pulled in only by `expo > @expo/cli` (archive extraction in the Expo **build CLI**), which pins `tar@^6` — an unpatched line that kept accumulating advisories (11 GHSAs at the point of the switch, incl. one critical). Forcing the patched `tar@7` major cleared the whole set; the CLI's tar usage survives the major bump (verified by the web export in CI's docker build). Previously these were accepted below — an exception list that only ever grew, which is exactly what this file says to avoid. |

## Accepted (ignored) — build/CLI tooling only, never shipped

Every entry below is reached **only** through the **Expo build CLI**
(`expo > @expo/cli > …`) or **drizzle-kit**, the migration CLI `better-auth`
pulls in. pnpm classifies these as "production" because `expo`, `better-auth`,
and `drizzle-kit` are runtime dependency *entries* — but the vulnerable
sub-packages are their build machinery (archive extraction, bundling, CSS
processing, native-project scaffolding, telemetry). This code **never ships in
the app bundle** and **never runs on a user device or in the server request
path**. Where a fixed line exists that the toolchain tolerates we take the
override (see above — that is how the entire `tar@6` advisory set, once 11
entries in this table, was resolved); only where no such line exists do we
accept the advisory instead.

These are advisories **OSV-Scanner** surfaces that the old gate never did: OSV
scans the whole lockfile at every severity, whereas `pnpm audit --prod
--audit-level high` only checked production deps at high+ severity (so it
skipped the medium `esbuild`/`postcss` findings, and its npm-backed DB did not
carry the `uuid` advisory).

| GHSA | Package | Severity | Path (build/CLI only) |
|------|---------|----------|------------------------|
| GHSA-67mh-4wv8-2f99 | esbuild | 5.3 Med | better-auth > drizzle-kit (+ tsx/vite dev toolchain) |
| GHSA-qx2v-qp2m-jg93 | postcss | 6.1 Med | expo > @expo/cli > @expo/metro-config > postcss |
| GHSA-w5hq-g745-h8pq | uuid (7.0.3 & 8.3.2) | 7.5 High | expo > @expo/cli (xcode > @expo/config-plugins; @expo/bunyan > @expo/rudder-sdk-node) |

**Revisit when:** the Expo SDK, `drizzle-kit`, or `better-auth` is upgraded (each
tends to move the pinned sub-package onto a patched line). At that point, re-run
the scan and remove any GHSA that no longer resolves from both `osv-scanner.toml`
and the legacy `pnpm.auditConfig.ignoreGhsas` — keep this list as short as the
toolchain allows, and never allowlist an advisory in code we actually ship.

> **Scope note:** OSV-Scanner scans the whole lockfile, not only the `--prod`
> subtree `pnpm audit` used to. Dev/build-time advisories can therefore surface
> here; add them to `osv-scanner.toml` with a documented reason (build-tool only,
> not shipped) or fix them — same discipline as above. A finding that reaches
> shipped runtime code (the app bundle or the server request path) must be fixed,
> not accepted, regardless of severity.
