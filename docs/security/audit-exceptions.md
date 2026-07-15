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

## Accepted (ignored) — Expo build CLI only, never shipped

All of these sit under `apps/mobile > expo > @expo/cli > tar` — the archive
extractor the **Expo command-line tool** uses at build time (downloading SDKs,
unpacking prebuilt artifacts). `@expo/cli` is a transitive dependency of the
`expo` runtime package, so pnpm classifies it as "production", but this code
**never ships in the app bundle** and never runs on a user device or server. The
patched line is `tar@>=7.x`, which `@expo/cli` pins to `^6` — bumping it via
override breaks the CLI, so we accept the advisories instead of destabilizing the
toolchain.

| GHSA | Package | Path |
|------|---------|------|
| GHSA-34x7-hfp2-rc4v | tar | expo > @expo/cli > tar |
| GHSA-8qq5-rm4j-mr97 | tar | expo > @expo/cli > tar |
| GHSA-83g3-92jg-28cx | tar | expo > @expo/cli > tar |
| GHSA-qffp-2rhf-9h96 | tar | expo > @expo/cli > tar |
| GHSA-9ppj-qmqm-q256 | tar | expo > @expo/cli > tar |
| GHSA-r6q2-hw4h-h46w | tar | expo > @expo/cli > tar |

**Revisit when:** the Expo SDK is upgraded (each SDK bump tends to move
`@expo/cli` onto a newer `tar`). At that point, re-run the scan and remove any
GHSA that no longer resolves from both `osv-scanner.toml` and the legacy
`pnpm.auditConfig.ignoreGhsas` — the goal is to keep this list as short as the
toolchain allows, and to never allowlist an advisory in code we actually ship.

> **Scope note:** OSV-Scanner scans the whole lockfile, not only the `--prod`
> subtree `pnpm audit` used to. Dev/build-time advisories can therefore surface
> here; add them to `osv-scanner.toml` with a documented reason (build-tool only,
> not shipped) or fix them — same discipline as above.
