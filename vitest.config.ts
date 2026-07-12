import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

// Coverage gate is architectural (SKILL §3.4): ≥90% on core logic.
// `packages/domain` (deterministic core, ADR-0005) and `packages/design`
// (design-token logic — theme resolver, project-color assignment, WCAG
// contrast) are pure and held to the bar; glue/placeholder packages are
// excluded until they carry real logic with their own thresholds.
//
// The SWC transform replaces esbuild for tests so `emitDecoratorMetadata` works:
// NestJS DI (apps/api, ADR-0025) reads constructor param types from decorator
// metadata, which esbuild does not emit. SWC transforms the pure packages
// identically, so the domain/design suites are unaffected.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', tsx: true, decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          react: { runtime: 'automatic' },
        },
        target: 'es2022',
        keepClassNames: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // react-native → react-native-web for all test code *and* transitive deps
      'react-native': 'react-native-web',
      // react-native-svg's commonjs entry does require('react-native') which
      // bypasses Vite's alias and hits Flow syntax Node can't parse.  Alias to
      // a lightweight test shim instead.
      'react-native-svg': new URL('./test/__mocks__/react-native-svg.tsx', import.meta.url)
        .pathname,
      // react-native-reanimated needs the native/worklet runtime; alias to a test
      // shim so component render tests don't load its native source (ADR-0027).
      'react-native-reanimated': new URL(
        './test/__mocks__/react-native-reanimated.tsx',
        import.meta.url,
      ).pathname,
      // @shopify/flash-list ships native/Flow syntax Vitest can't transform, and
      // virtualization is irrelevant to render tests — alias to an eager shim (ADR-0027).
      '@shopify/flash-list': new URL('./test/__mocks__/flash-list.tsx', import.meta.url).pathname,
      // Workspace packages → source so Vitest transforms them via SWC/Oxc
      '@mydevtime/design': new URL('./packages/design/src/index.ts', import.meta.url).pathname,
      '@mydevtime/domain': new URL('./packages/domain/src/index.ts', import.meta.url).pathname,
      '@mydevtime/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@mydevtime/local-db': new URL('./packages/local-db/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['{packages,apps}/*/src/**/*.test.{ts,tsx}'],
    browser: {
      instances: [],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/domain/src/**/*.ts', 'packages/design/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
