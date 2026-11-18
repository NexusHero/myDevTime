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
`resolutions` (fixes) and in [`osv-scanner.toml`](../../osv-scanner.toml)
(`[[IgnoredVulns]]`, accepted). The legacy `pnpm.auditConfig.ignoreGhsas` list is
kept in sync for anyone running `pnpm audit` locally, but CI reads
`osv-scanner.toml`.

## Fixed via override

| Package | Override | Why |
|---------|----------|-----|
| `@xmldom/xmldom` | `>=0.8.13` | Pulled in only by `expo > @expo/cli > @expo/plist` (iOS plist parsing in the Expo **build CLI**). A patch-level bump clears 5 high advisories with no runtime effect. |
| `tar` | `^7.5.19` | Pulled in only by `expo > @expo/cli` (archive extraction in the Expo **build CLI**), which pins `tar@^6` — an unpatched line that kept accumulating advisories (11 GHSAs at the point of the switch, incl. one critical). Forcing the patched `tar@7` major cleared the whole set; the CLI's tar usage survives the major bump (verified by the web export in CI's docker build). Previously these were accepted below — an exception list that only ever grew, which is exactly what this file says to avoid. |
| `find-my-way` | `>=9.7.0` | Fastify 5's core HTTP router — **shipped, in the server request path**, so this is fixed, not accepted. `find-my-way@9.6.0` carried GHSA-c96f-x56v-gq3h (7.5); the `^9.7.0` patch line clears it and stays within Fastify 5's `find-my-way@^9` peer range (API build + boot + integration tests green). |
| `postcss` | `>=8.5.18` | CSS processor inside the Expo build CLI (`expo > @expo/cli > @expo/metro-config`). `postcss@8.4.49` carried GHSA-6g55-p6wh-862q and GHSA-r28c-9q8g-f849 (both 7.5) plus the older GHSA-qx2v-qp2m-jg93 (6.1, previously accepted below). The `8.5.x` line is API-compatible with `8.4.x`, so a single minor bump clears all three — taking the override over the accept, per the discipline above. |
| `fastify` | `^5.12.8` | **Shipped, in the server request path.** `@nestjs/platform-fastify@11.2.7` pins `fastify@5.11.3` exactly, so the HTTP server ran a different (vulnerable, 7 GHSAs up to 8.1) Fastify than the `^5.12.5` the API declares. A minor bump inside Fastify 5; API build + integration tests green. |
| `js-yaml@4` | `^4.3.2` | `@nestjs/swagger` pins `4.3.0` exactly (OpenAPI YAML rendering, shipped). Patch bump clears two CPU-exhaustion GHSAs. |
| `@expo/plist>@xmldom/xmldom` | `0.8.15` | Moved the existing pin to the patched 0.8.x line (10 GHSAs on 0.8.13). |
| `fast-uri@3` | `^3.1.9` | **Shipped** — Fastify's ajv schema compiler (API request path). Patch bump clears four GHSAs. |
| `@fastify/static>glob` | `^14.0.2` | **Shipped** — `@fastify/static@9` (Swagger UI assets) pins `glob@^13`; glob 14 (+ minimatch 11) clears GHSA-3g3m-2fjr-6pw4 / GHSA-g3hv-75wg-m249 on the server. Same CommonJS `glob()` API; `apps/api/src/docs-assets.test.ts` pins that `/docs` and its assets are still served. |
| `undici@6` · `undici@7` | `^6.29.1` · `^7.30.1` | Expo CLI and jsdom/cheerio. Patch bumps clear up to eight GHSAs each. |
| `node-forge@1` | `^1.4.3` | Expo CLI dev-server certificates. 1.4.3 fixes all 20 GHSAs on 1.4.0 — including GHSA-86w9-cpqp-85rv, previously *accepted* below as "no fix released". |
| `compression@1` · `shell-quote@1` · `source-map-js@1` · `dompurify@3` | `^1.8.2` · `^1.11.0` · `^1.2.2` · `^3.4.17` | Expo dev server, react-devtools-core, css-tree/postcss, mermaid. Same-major bumps. |
| `vite` | `^8.3.3` | Vitest's dev server (test runner only). Replaces the old `>=6.4.3` floor; clears five GHSAs on 8.1.3. |

## Fixed via patch (backport)

Where the upstream fix exists only in a release the dependency tree cannot take, the fix is
backported as a pnpm patch ([`patches/`](../../patches/README.md)) with a regression test that
is red without it. OSV-Scanner matches on the version number only, so the advisory is listed in
`osv-scanner.toml` — marked *fixed by patch*, not accepted.

| GHSA | Package | Severity | Why a patch |
|------|---------|----------|-------------|
| GHSA-vcc3-ghjq-m6fr · GHSA-qr28-fpjm-wq7f | decode-uri-component (0.2.2) | High (CPU DoS) | **Shipped in the web bundle** (`query-string@7` via `@react-navigation/core` and `expo-router`). The fix, 0.5.0, is ESM-only and `query-string@7` `require`s it; moving react-navigation off `query-string` (core ≥ 7.23) breaks the web export because `expo-router` imports `query-string` undeclared. Measured before/after: 400 × `%FF` took ~2 s, 100 000 × now take ~15 ms. The patch also carries 0.5.1's single-pass run replacement (GHSA-qr28): 20 000 distinct runs took ~1.6 s on the 0.5.0 port, now a few ms. |

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
| GHSA-w5hq-g745-h8pq | uuid (7.0.3 & 8.3.2) | 7.5 High | expo > @expo/cli (xcode > @expo/config-plugins; @expo/bunyan > @expo/rudder-sdk-node) |
| GHSA-5p2g-fcmc-qvqq · GHSA-w3rx-r6r6-pgpr | image-size (1.2.1) | 8.7 High | expo > metro@0.81 (bundler). The fix is the 2.x major, which metro@0.81 (Expo SDK 52) does not accept; metro reads our own image assets at build time. Revisit with the Expo SDK upgrade. |
| GHSA-3g3m-2fjr-6pw4 | glob (10.5.0) | Med | `@expo/cli`, `@expo/config(-plugins)`, `cacache`, `sucrase` — build tooling. Fix is glob 14, which they reject. The shipped `@fastify/static` copy is fixed by override (above). |
| GHSA-g3hv-75wg-m249 | minimatch (9.0.9, 10.2.5) | Med | ESLint (`@eslint/config-array`) and the Expo CLI — dev/build only. Fix is minimatch 11. |
| GHSA-fc5q-39xc-vjpf | picomatch (2.3.2, 3.0.2, 4.0.5, 4.0.7) | Med | jest, metro, micromatch — build/test tooling. **No patched release exists.** Patterns are ours. |
| GHSA-238p-pmpm-9mq7 | katex (0.16.47) | Med | `@mermaid-js/mermaid-cli` (root devDependency rendering `docs/diagrams/*.svg` from our own sources). `mermaid` accepts only `katex@^0.16`; the fix is 0.18. |
| GHSA-mrhx-c7xc-m3w5 | zod (3.25.76) | Med | `puppeteer > chromium-bidi` under `mermaid-cli` — docs tooling. Fixed only in zod 4; the app itself is on `zod@^4.6.7`. |
| GHSA-83w8-p2f5-377r · GHSA-8pvw-jcv7-9cmj | @fastify/static (9.3.0) | 7.5 High · 5.3 Med | optionalDependency of `fastify` and `@nestjs/swagger` (Swagger UI static assets) — **not** a build tool. Accepted, not fixed, because the patched line is v10 and `@nestjs/swagger`'s peer range is strictly `v8 \|\| v9`; adopting v10 breaks Swagger UI init. Low risk: no wildcard/user-controlled static paths are served through it. Revisit when `@nestjs/swagger` supports `@fastify/static@10`. (Replaces the now-resolved GHSA-mh99-v99m-4gvg.) |

The **image scan gate** (Trivy, `deploy.yml`) carries the same `@fastify/static` exception
by CVE id in [`.trivyignore`](../../.trivyignore); keep the two lists in step.

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
