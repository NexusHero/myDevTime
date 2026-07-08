import { defineConfig } from 'vitest/config'

/**
 * Machine-verification harness for the spike's *pure* logic cores (the .ts files
 * — no React Native imports). These run in this repo's Node/vitest without the
 * native toolchain, producing the deterministic evidence cited in
 * docs/spikes/0001-client-rn-expo.md. The .tsx UI files are the human-runnable
 * scaffold (see README) and are intentionally excluded here.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
