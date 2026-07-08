import { defineConfig } from 'vitest/config'

// Coverage gate is architectural (SKILL §3.4): ≥90% on core logic.
// `packages/domain` (deterministic core, ADR-0005) and `packages/design`
// (design-token logic — theme resolver, project-color assignment, WCAG
// contrast) are pure and held to the bar; glue/placeholder packages are
// excluded until they carry real logic with their own thresholds.
export default defineConfig({
  test: {
    include: ['{packages,apps}/*/src/**/*.test.ts'],
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
