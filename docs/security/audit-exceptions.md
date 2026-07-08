# Dependency audit exceptions

`pnpm audit --prod --audit-level high` is a CI gate ([`.github/workflows/security.yml`](../../.github/workflows/security.yml),
ADR-0016). This file documents every advisory we knowingly accept, so the
allowlist is auditable and revisited — not a silent suppression.

Configuration lives in the root [`package.json`](../../package.json) under
`pnpm.overrides` (fixes) and `pnpm.auditConfig.ignoreGhsas` (accepted).

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
`@expo/cli` onto a newer `tar`). At that point, re-run `pnpm audit --prod` and
remove any GHSA that no longer resolves — the goal is to keep this list as short
as the toolchain allows, and to never allowlist an advisory in code we actually
ship.
