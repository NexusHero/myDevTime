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
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
        keepClassNames: true,
      },
    }),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  test: {
    include: ['{packages,apps}/*/src/**/*.test.{ts,tsx}'],
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
