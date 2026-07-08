#!/usr/bin/env node
// Deterministic dependency-check (REQ-003 / ADR-0005): packages/domain is the
// pure, deterministic core. Production sources there may import ONLY their own
// relative modules — any non-relative import (fastify, drizzle, zod, node:*, …)
// would betray a dependency the core must not carry, and fails the gate. Kept as
// a plain node script (like check-docs.mjs) because the domain tsconfig has no
// Node types, so a scanning *.test.ts would not typecheck.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(root, 'packages', 'domain', 'src')

function tsFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsFiles(full)
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
  })
}

const importSpecifier = /(?:from|import)\s+['"]([^'"]+)['"]/g
const offenders = []
for (const file of tsFiles(srcDir)) {
  const src = readFileSync(file, 'utf8')
  for (const match of src.matchAll(importSpecifier)) {
    const spec = match[1]
    if (spec && !spec.startsWith('.')) offenders.push(`${file.replace(root, '')}: ${spec}`)
  }
}

if (offenders.length > 0) {
  console.error('✗ packages/domain must stay pure — non-relative imports found:')
  for (const offender of offenders) console.error(`  - ${offender}`)
  process.exit(1)
}
console.log('✓ domain purity: production sources import only relative modules')
