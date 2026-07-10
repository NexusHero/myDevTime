# ADR 0027: Mobile UI Testing Strategy

## Status

Accepted

## Context

Issue #39 (prototype validation) required adjustments to the `TodayScreen` layout (moving the `Island` component out of the scroll flow to ensure it floats over the content). Under the *Ultimate Development Process* (SKILL §3), such logic changes require a test. However, the existing test runner (Vitest, ADR-0014) was only testing the deterministic core (`packages/domain`, `packages/design`) and no UI component testing strategy was established for `apps/mobile`.

We need a way to mount and assert against React Native components without standing up a full device emulator, while remaining compatible with our Vitest monorepo toolchain.

## Decision

- **Test Library:** Use `@testing-library/react-native` coupled with `react-test-renderer` for component tests in the mobile app.
- **Test Runner:** Continue using **Vitest** (standardized in ADR-0014). We will adjust the root `vitest.config.ts` to include `*.test.tsx` files.
- **Environment:** React Native components will be tested in a Node/JSDOM environment. Any purely native modules that break the Node environment must be mocked at the package/app boundary.

## Alternatives considered

- **jest-expo:** The officially supported Expo testing pipeline. Rejected because it relies on Jest, which contradicts ADR-0014 (standardization on Vitest for speed and ESM support). Running two different test runners in the monorepo splits the tooling and complicates the CI pipeline.
- **Detox / Appium (e2e):** Excellent for deep integration but too slow and heavy for fast developer feedback loops (TDD, local gates). Better suited for a later stage.

## Consequences

- We can now write component tests (level 3 of the testing pyramid) for `apps/mobile` screens.
- Tests will run instantly alongside our pure logic tests in `pnpm test`.
- We may need to explicitly mock native modules (e.g., Reanimated, Safe Area Context) in the future if they cannot be rendered by `react-test-renderer`.
