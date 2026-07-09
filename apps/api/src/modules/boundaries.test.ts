import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODULE_NAMES } from '../core/module.js'

/**
 * Module-boundary check (ADR-0003/0015/0025 acceptance criterion): a business
 * module may NOT import another business module's internals. It may reference two
 * public surfaces only: the other module's `contract.ts` (interfaces + the
 * re-exported guard/param-decorator) and its `<name>.module.ts` (the NestJS DI
 * entry point it lists in `imports:` to consume exported providers). Everything
 * else — services, controllers, tokens, adapters — stays private. This
 * deterministic scan fails the build on any violation, so the seams can't quietly
 * erode.
 */
const modulesDir = fileURLToPath(new URL('.', import.meta.url))
const others = new Set<string>(MODULE_NAMES)

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsFiles(full)
    return full.endsWith('.ts') ? [full] : []
  })
}

const importRe = /from\s+['"]([^'"]+)['"]/g

describe('module boundaries', () => {
  it.each(MODULE_NAMES)('%sModule_ImportsOnlyOwnInternalsAndOthersContracts', self => {
    const files = tsFiles(join(modulesDir, self)).filter(f => !f.endsWith('.test.ts'))
    const violations: string[] = []

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(importRe)) {
        const spec = m[1]
        if (!spec) continue
        // Cross-module reference looks like `../<other>/...`.
        const cross = /^\.\.\/([a-z]+)\//.exec(spec)
        const target = cross?.[1]
        if (!target || target === self || !others.has(target)) continue
        const allowed = spec.endsWith('/contract.js') || spec.endsWith(`/${target}.module.js`)
        if (!allowed) {
          violations.push(`${file} imports ${spec}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
