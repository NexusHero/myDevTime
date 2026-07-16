#!/usr/bin/env node
// Deterministic, dependency-free requirements-traceability gate (ADR-0053).
// Bridges the Requirements Register (docs/architecture.md §1) to the test suite
// via docs/testing/requirements-traceability.md. Fails the build on:
//   1. a register REQ-NNN with no row in the traceability matrix (coverage gap),
//   2. a matrix row referencing a test file that doesn't exist (dead reference),
//   3. a matrix row for a REQ that isn't in the register (orphan row),
//   4. a REQ marked "Verified" that names no ACCEPTANCE-tier test — the requirement
//      exercised end-to-end against the real system (SKILL §7). Acceptance tier =
//      an API-integration test (`*.integration.test.ts`), a browser E2E spec
//      (`*.spec.ts`), a client render test (`*.test.tsx`), or the container smoke
//      script. A row whose Notes say "Deferred" is exempt (the feature is dormant,
//      not delivered). Domain/API-unit `*.test.ts` alone does not satisfy this.
// It does NOT judge whether a requirement is "done" — only that its traceability
// is complete, its named tests are real, and every delivered requirement carries
// an acceptance-tier test. No LLM, no network.

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = process.cwd()
const REGISTER = join(ROOT, 'docs', 'architecture.md')
const MATRIX = join(ROOT, 'docs', 'testing', 'requirements-traceability.md')

const problems = []

/** REQ ids in the register: table rows whose first cell is `REQ-NNN`. */
function registerReqs() {
  const text = readFileSync(REGISTER, 'utf8')
  const ids = new Set()
  const re = /^\|\s*(REQ-\d{3})\s*\|/gm
  for (const m of text.matchAll(re)) ids.add(m[1])
  return ids
}

/** Whether a named path is an acceptance-tier test (real system, end-to-end). */
function isAcceptancePath(p) {
  return (
    p.endsWith('.integration.test.ts') ||
    p.endsWith('.integration.test.tsx') ||
    p.endsWith('.spec.ts') ||
    p.endsWith('.test.tsx') ||
    p.endsWith('container-smoke.sh')
  )
}

/**
 * Matrix rows keyed by REQ id, carrying the coverage state, the backtick-quoted
 * test paths they name, and whether the row is marked Deferred (dormant → exempt
 * from the acceptance requirement).
 */
function matrixRows() {
  const text = readFileSync(MATRIX, 'utf8')
  const rows = new Map()
  const rowRe = /^\|\s*(REQ-\d{3})\s*\|([^|]*)\|(.*)$/gm
  const pathRe = /`([^`]+\.(?:test|spec|integration\.test)\.tsx?|[^`]*\.sh)`/g
  for (const m of text.matchAll(rowRe)) {
    const state = m[2].trim()
    const rest = m[3]
    const paths = []
    for (const p of rest.matchAll(pathRe)) paths.push(p[1])
    rows.set(m[1], { state, paths, deferred: /deferred/i.test(rest) })
  }
  return rows
}

const register = registerReqs()
const rows = matrixRows()

if (register.size === 0)
  problems.push('no REQ-NNN rows found in the register (docs/architecture.md)')

// 1. Every register REQ has a matrix row.
for (const id of register) {
  if (!rows.has(id))
    problems.push(`missing traceability row: ${id} is in the register but not in the matrix`)
}

// 3. No orphan matrix rows.
for (const id of rows.keys()) {
  if (!register.has(id))
    problems.push(`orphan traceability row: ${id} is in the matrix but not in the register`)
}

// 2. Every named test path exists.
for (const [id, { paths }] of rows) {
  for (const p of paths) {
    if (!existsSync(resolve(ROOT, p))) {
      problems.push(`dead test reference: ${id} names \`${p}\`, which does not exist`)
    }
  }
}

// 4. Every Verified (non-deferred) REQ names an acceptance-tier test.
let accepted = 0
for (const [id, { state, paths, deferred }] of rows) {
  const hasAcceptance = paths.some(isAcceptancePath)
  if (hasAcceptance) accepted++
  if (state === 'Verified' && !deferred && !hasAcceptance) {
    problems.push(
      `missing acceptance test: ${id} is Verified but names no acceptance-tier test ` +
        `(*.integration.test.ts / *.spec.ts / *.test.tsx / container-smoke.sh)`,
    )
  }
}

if (problems.length > 0) {
  console.error(`✗ requirements-coverage check failed (${String(problems.length)}):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const covered = [...rows.values()].filter(r => r.paths.length > 0).length
console.log(
  `✓ requirements-coverage check passed (${String(register.size)} requirements, ` +
    `${String(covered)} with named tests, ${String(accepted)} with an acceptance-tier test)`,
)
