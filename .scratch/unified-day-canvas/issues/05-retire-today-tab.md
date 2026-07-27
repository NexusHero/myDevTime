## Parent

ADR-0075 (Unified Day Canvas — retire the Today tab, modernize the calendar). Plan: `plans/unified-day-canvas-and-calendar-modernization.md` Step 5.

## What to build

Retire the Today tab from the navigation. The Planner Day view (from #364) is now the single home for the daily loop.

- Update `PHONE_TABS` (packages/design/src/nav.ts): drop `'today'`, keep `planner · projects · reports · profile` (4 tabs).
- Update `SIDEBAR_ITEMS` (packages/design/src/nav.ts): drop `'today'`, keep `planner · projects · reports` (3 places).
- The `Screen` type keeps `'today'` — add a redirect: `/today` -> `/planner` (Expo Router). Deep links, OS quick actions (REQ-039), and the command bar keep working.
- Update `ShellChrome` (apps/mobile/src/shell/ShellChrome.tsx): default screen is `planner`.
- Move the Today-only companions (SeviWatch, EveningCompanionCard, MoodEaseCard) into the Planner Day view, below the `ShutdownCard` (Option A, confirmed by the owner).
- Update the nav tests (packages/design/src/nav.test.ts) to assert the new counts + the redirect.

This supersedes ADR-0063 point 1 (four-places -> three-places). ADR-0063 points 2-5 stand unchanged.

## Acceptance criteria

- [ ] `PHONE_TABS` is `['planner', 'projects', 'reports', 'profile']` (4 items)
- [ ] `SIDEBAR_ITEMS` is `['planner', 'projects', 'reports']` (3 items)
- [ ] Navigating to `/today` redirects to `/planner`
- [ ] The `Screen` type still includes `'today'` (deep-link compatibility)
- [ ] `ShellChrome` defaults to `planner`
- [ ] SeviWatch, EveningCompanionCard, MoodEaseCard render on the Planner Day view below the ShutdownCard
- [ ] Nav tests assert the new tab/sidebar counts + the redirect
- [ ] No surface is orphaned — the nav test asserts every `Screen` is reachable
- [ ] `./test.sh` passes

## Blocked by

- #364 (hero tracker + Feierabend wired into Planner Day)
