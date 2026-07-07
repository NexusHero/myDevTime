#!/usr/bin/env node
// Point git at our tracked hooks (SKILL §5: automate enforcement, don't rely
// on memory). Runs via the root `prepare` script on every `pnpm install`.
// No-op outside a git work tree (e.g. CI checkouts, packed installs).

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

try {
  if (!existsSync('.git')) process.exit(0)
  execFileSync('git', ['config', 'core.hooksPath', 'scripts/hooks'], { stdio: 'ignore' })
  console.log('✓ git hooks installed (core.hooksPath = scripts/hooks)')
} catch {
  // Never fail an install because hooks could not be wired.
  process.exit(0)
}
