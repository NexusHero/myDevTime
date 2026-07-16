# myDevTime — desktop app-usage companion (macOS / Windows)

A standalone Electron companion that captures the **focused application** on macOS and
Windows and shows a **local** per-app breakdown, reusing the deterministic
`summarizeActivity` core from `@mydevtime/domain` (REQ-042,
[ADR-0059](../docs/adr/0059-desktop-usage-companion.md)).

> **Status: documented scaffold, not a running feature here.** The aggregation it uses
> (`summarizeActivity`) is real and unit-tested in `@mydevtime/domain`. The Electron shell
> + `active-win` native capture **cannot be built or run in this repo's CI/dev
> environment** — build and verify it locally on a Mac/Windows machine. It is a top-level
> folder with its own toolchain and is **not** a pnpm-workspace member, so it never enters
> the app's `./test.sh` gate.

## Why a separate app

The Expo web/managed build runs in a browser sandbox with no OS access; real desktop
capture needs a separate native process (ADR-0057). This companion is that process. It
does **not** feed the mobile app's in-process capture port — it renders its own local
view (a future revision could sync, but the current stance is local-only, per ADR-0059).

## What's here

- `main.cjs` — Electron main: opens the window, starts/stops capture on the renderer's
  request (consent-gated), streams the breakdown to the UI.
- `capture.cjs` — polls `active-win` for the focused app, turns the elapsed time between
  polls into spans, and aggregates them with `summarizeActivity` (the shared core).
- `preload.cjs` — a narrow, context-isolated bridge (start / stop / onUpdate only).
- `index.html` — a minimal renderer showing the breakdown.

## Build & run (on a Mac or Windows machine)

```sh
# 1. Build the shared domain package the companion imports.
pnpm --filter @mydevtime/domain build

# 2. Install + run the companion (its own, non-workspace install).
cd desktop-companion
pnpm install
pnpm start
```

- **macOS**: `active-win` needs **Screen Recording** permission
  (System Settings → Privacy & Security → Screen Recording) to read window/app titles.
- **Windows**: no special permission for the foreground-app owner name.

## Verifying on your machine

After it runs, follow the on-hardware verification protocol —
[`docs/verification/native-trackers.md`](../docs/verification/native-trackers.md)
(Track B) — for the acceptance criteria and what to record in the repo when it passes.

## Privacy

Local-only + consent-first: capture runs **only** while you have the companion open and
tracking enabled, records **app names only**, and keeps everything **on the machine** —
nothing is uploaded (the server ingest was deliberately rejected on data-protection
grounds; see ADR-0058/0059).
