# ADR 0045: Expo Router (file-based navigation) + List Virtualization

## Status

Accepted (owner decision) — **supersedes the hand-rolled client router** (the `AppShell` +
`ScreenView` active-screen switch introduced with the app shell of #11). The design navigation
model — `packages/design`'s `nav.ts` (`ROUTES`, `PHONE_TABS`, `SIDEBAR_ITEMS`, `buildPath`,
`parsePath`) — is **retained as the source of truth** and now drives Expo Router. Realizes the
Expo-Router evaluation spike ([#191](https://github.com/NexusHero/myDevTime/issues/191)). Bound by
[ADR-0004](0004-react-native-expo-client.md) (RN + Expo, one codebase) and
[ADR-0035](0035-bounded-screens.md) (bounded screens / one scroll pane).

## Context

Two navigation/performance gaps surfaced once the web/PWA build shipped (#199, the app now runs on
Windows/Mac browsers):

1. **The hand-rolled router had no URLs.** `AppShell` held the active screen in `useState` and
   swapped a `switch` (`ScreenView`). On native that was fine; on web every screen was the same URL
   — no browser back/forward, no bookmarks, no shareable links, no deep links. For a desktop-web app
   that is a correctness gap, and the AI assistant / OS quick actions (REQ-039) need real deep links.
2. **Long lists rendered eagerly.** Every list screen used a `ScrollView` + `.map()` (7 screens, 0
   virtualized). Unbounded lists — the credit ledger (REQ-027), a task's entry history (REQ-004) —
   mount **every** row up front. Invisible with demo data; with months of real data (thousands of
   entries) this is where scroll jank and slow mounts come from.

The owner chose the full framework migration (Expo Router) over a lighter web-only `React.lazy`
split, accepting a larger change now for the correct end state (real URLs) rather than a throwaway
interim.

## Decision

1. **Navigation = Expo Router (file-based).** Routes live under `apps/mobile/app/`, one file per
   entry in the design `ROUTES` table (`/today`, `/projects/:projectId`, `/profile/settings`, …).
   `app/_layout.tsx` is the single entry (`main` = `expo-router/entry`), hosting the providers that
   were in `App.tsx` and rendering the **persistent responsive chrome** (`ShellChrome`, refactored
   from `AppShell`) whose `<Slot />` mounts the routed screen. The chrome still asks
   `chromeForWidth` for tabs-on-phone / sidebar-on-tablet and derives the active item from the URL
   via `parsePath` — the model stays the source of truth; only the mechanism (URL + `<Slot />`)
   changed.

2. **Screens are unchanged; route files adapt them.** Screens keep their `onNavigate(screen,
   params)` / `onBack` props. A thin `useShellNav` hook maps those onto `router.push(buildPath(…))`,
   and each route file injects it. So no screen code (and none of the existing render tests) changed
   for the migration.

3. **Web output = `static` (SSG).** Each route prerenders to static HTML, so first **paint** shows
   content before the JS hydrates — a real first-paint win over the previous `output: "single"`
   blank-root SPA. **Honest limitation:** Metro's production web export still emits a **single JS
   bundle** — enabling `asyncRoutes` did **not** chunk-split it. So the migration does **not** reduce
   time-to-interactive via code-splitting; the web perf gain is SSG first-paint only. The larger,
   reliable performance win in this change is list virtualization (Decision 4), not JS splitting.

4. **Unbounded lists = `@shopify/flash-list`.** A new `ScreenListScaffold` (sibling of
   `ScreenScaffold`, same fixed-header + one-scroll-pane contract of ADR-0035) makes a virtualized
   `FlashList` the scroll pane, with non-list content as the list header/footer so a `FlashList` is
   never nested inside a `ScrollView`. Applied first to the two clearly unbounded lists — the credit
   ledger and a task's entry history. Only visible rows mount, so a multi-thousand-row history
   scrolls in roughly constant cost.

5. **Vendor confinement.** `expo-router` is confined to `app/` + `src/shell/`; `@shopify/flash-list`
   is confined to `ScreenListScaffold`. Nothing else imports either. The render-test suite (ADR-0027)
   imports screens directly, not route files, so it does not load the router.

## Consequences

- Real URLs / deep links / browser history on web, and native deep-linking, all from the one design
  nav model — the assistant and OS quick actions can link straight to a screen (REQ-039).
- New dependencies: `expo-router`, `react-native-screens`, `expo-linking`, `expo-constants`,
  `@shopify/flash-list` (all SDK-52-pinned). `App.tsx` / `index.ts` / `AppShell` / `ScreenView` are
  retired.
- Web first paint improves (prerendered HTML); **time-to-interactive does not** (single JS bundle) —
  documented so no one mistakes SSG for code-splitting later.
- Long lists stop being an O(n)-mount cost; the ledger and entry history scale to real data. The
  remaining eager lists can adopt `ScreenListScaffold` incrementally.
- `output: static` prerenders in Node, so providers must stay browser-API-safe at module/first-render
  time (the DB open is already in a `useEffect`; PWA registration moved into a layout effect). Verified
  by a green `expo export --platform web` (17 routes prerendered).

## Alternatives considered

- **Web-only `React.lazy` split, keep the hand-rolled router:** smaller and no framework migration,
  and it would actually split the JS — but it is a throwaway interim that never delivers URLs/deep
  links, and leaves two navigation code paths. Rejected in favour of the correct end state.
- **Stay hand-rolled (status quo):** no URLs, no history, no deep links on web — the gap that
  motivated this. Rejected.
- **`FlatList` instead of `FlashList`:** built-in, no dependency, but measurably heavier for long
  lists; `FlashList` recycles views and is the established best-practice for large RN lists.
- **`output: "server"` (RSC/SSR) for true code-splitting:** would split the JS, but pulls in a server
  runtime and a much larger surface for what is a client-only offline app. Out of scope for a
  standalone offline product; revisit only if a server tier lands.
