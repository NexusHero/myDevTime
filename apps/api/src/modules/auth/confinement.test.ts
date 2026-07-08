import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Confinement gate (ADR-0007/0017): Better-Auth is a volatile vendor and must
 * live ONLY inside the `auth` module. Nothing else in the API may import it —
 * upstream code sees `AuthenticatedUser`, never Better-Auth types. This
 * deterministic scan fails the build the moment the boundary leaks.
 */
const srcDir = fileURLToPath(new URL('../..', import.meta.url)) // apps/api/src
const authDir = join(srcDir, 'modules', 'auth')

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsFiles(full)
    return full.endsWith('.ts') ? [full] : []
  })
}

const betterAuthImport = /from\s+['"]better-auth[^'"]*['"]/

describe('better-auth confinement', () => {
  it('BetterAuth_ImportedOnlyWithinAuthModule', () => {
    const offenders = tsFiles(srcDir)
      .filter(file => !file.startsWith(authDir))
      .filter(file => betterAuthImport.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })
})
