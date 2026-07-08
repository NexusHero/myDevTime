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
