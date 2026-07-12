# @mydevtime/mobile

The myDevTime client — **iOS + Android + Web from one Expo / React Native codebase**
([ADR-0004](../../docs/adr/0004-react-native-expo-client.md), Accepted provisional). This is the
scaffold for the design system & app shell ([#11](https://github.com/NexusHero/myDevTime/issues/11)):
the app boots, themes itself from [`@mydevtime/design`](../../packages/design), and renders the
responsive navigation shell driven by that package's route/layout model.

```bash
pnpm install          # once, from the repo root
cd apps/mobile
pnpm start            # builds the workspace packages first, then Metro (i / a / w)
# direct `npx expo start` also works, but run `pnpm build:deps` first —
# the app imports the built dist of @mydevtime/design (Metro bundles from dist).
```

Verified to bundle: `npx expo export --platform web` produces a runnable web bundle
(Metro resolves the app, the component library, and `@mydevtime/design` cleanly).

## Run on Windows / Mac (web / PWA)

The client is offline-first (local SQLite; no server needed for standalone use), so the web build
is a real way to run myDevTime on a **Windows or Mac desktop** — no App Store, no Xcode, no
Android Studio. Two ways:

```bash
cd apps/mobile
pnpm run web          # dev server; open the printed http://localhost URL in any browser
# — or produce a static build you can serve/host anywhere —
pnpm run export:web   # writes a static SPA to apps/mobile/dist/
```

`export:web` emits a self-contained static site under `dist/`. Serve it with any static server
(e.g. `npx serve apps/mobile/dist`) and open it in Edge, Chrome, Safari, or Firefox.

**Installable, offline-capable (PWA):** the build ships a web app manifest
(`public/manifest.webmanifest`) and an offline app-shell service worker (`public/sw.js`), both
registered at startup by `src/web/registerPwa.ts` (a no-op on native). Once the page has been
opened over `https://` (or `localhost`), the browser offers **"Install"** — the app then launches
in its own window and its shell keeps working without a network. Everything under `public/` is
copied verbatim into `dist/` by `expo export`.

## What's wired

- **`ThemeProvider`** (`src/theme/`) — resolves the effective theme from the OS color scheme +
  the user's preference (pure `resolveMode`, unit-tested) and hands the whole design system to
  every screen via `useTheme()`. Dark-first, light a first-class sibling.
- **`AppShell`** (`src/shell/`) — reads the viewport width, asks `@mydevtime/design`'s
  `chromeForWidth` for the chrome, and renders **bottom tabs on phone** / **sidebar on
  tablet & web** from `PHONE_TABS` / `SIDEBAR_ITEMS`. The nav model is the source of truth.
- **Screens** — one themed placeholder per deep-linkable screen; the real Today/Planner/… views
  and the component set (Island, ghost blocks, canvas primitives) land in later phases of #11.

## Testing note

The correctness-critical logic (theme resolution, and the route/layout model in
`@mydevtime/design`) is pure and covered by the normal vitest gate. React Native component
*rendering* is intentionally **not** in the vitest gate — a component catalog (Storybook or
equivalent) with visual tests in CI is a follow-up phase of #11. The residual on-device checklist
(C1–C7) from the [spike findings](../../docs/spikes/0001-client-rn-expo.md) still applies before
ADR-0004 drops its "provisional" qualifier.
