# Dependency patches

Security backports applied by pnpm at install time (`patchedDependencies` in
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml)). A patch is the last resort, used only when
the upstream fix lives in a release our dependency tree cannot take; prefer an override
(`resolutions` in [`package.json`](../package.json)) or an upgrade. Every patch has a
regression test in [`scripts/patches.test.mjs`](../scripts/patches.test.mjs) that is red
without it, and an entry in [`docs/security/audit-exceptions.md`](../docs/security/audit-exceptions.md).

| Patch | Fixes | Why not upgrade | Drop when |
|-------|-------|-----------------|-----------|
| `decode-uri-component@0.2.2.patch` | GHSA-vcc3-ghjq-m6fr / CVE-2026-45822 — the fallback decoder is cubic in malformed `%XX` input (400 × `%FF` ≈ 2 s, a deep link can freeze the tab). Ports 0.5.0's linear-time decoder to CommonJS, keeping 0.2.2's `+` → space. | The fix (0.5.0) is ESM-only; `query-string@7` `require`s it. It ships in the web bundle via `@react-navigation/core` and `expo-router`, which imports `query-string` without declaring it, so dropping it from react-navigation (core ≥ 7.23) breaks the web build. | expo-router no longer needs `query-string@7` (Expo SDK upgrade). |

The Docker builds copy this directory before `pnpm install`; without it the frozen install fails.
