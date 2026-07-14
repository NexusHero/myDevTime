#!/usr/bin/env node
// Deterministic, dependency-free requirements-traceability gate (ADR-0053).
// Bridges the Requirements Register (docs/architecture.md §1) to the test suite
// via docs/testing/requirements-traceability.md. Fails the build on:
//   1. a register REQ-NNN with no row in the traceability matrix (coverage gap),
//   2. a matrix row referencing a test file that doesn't exist (dead reference),
//   3. a matrix row for a REQ that isn't in the register (orphan row).
// It does NOT judge whether a requirement is "done" — only that its traceability
// is complete and its named tests are real. No LLM, no network.

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

/** Matrix rows keyed by REQ id, carrying the backtick-quoted test paths they name. */
function matrixRows() {
  const text = readFileSync(MATRIX, 'utf8')
  const rows = new Map()
  const rowRe = /^\|\s*(REQ-\d{3})\s*\|(.*)$/gm
  const pathRe = /`([^`]+\.(?:test|spec|integration\.test)\.tsx?|[^`]*\.sh)`/g
  for (const m of text.matchAll(rowRe)) {
    const paths = []
    for (const p of m[2].matchAll(pathRe)) paths.push(p[1])
    rows.set(m[1], paths)
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
for (const [id, paths] of rows) {
  for (const p of paths) {
    if (!existsSync(resolve(ROOT, p))) {
      problems.push(`dead test reference: ${id} names \`${p}\`, which does not exist`)
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ requirements-coverage check failed (${String(problems.length)}):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const covered = [...rows.values()].filter(p => p.length > 0).length
console.log(
  `✓ requirements-coverage check passed (${String(register.size)} requirements, ` +
    `${String(covered)} with named tests)`,
)
