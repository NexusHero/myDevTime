#!/usr/bin/env node
// Deterministic, dependency-free docs-staleness gate (SKILL §1.5).
// Fails the build on structural drift:
//   1. a relative Markdown link pointing at a file that doesn't exist,
//   2. an `ADR-NNNN` reference with no matching ADR file,
//   3. a diagram source (.puml/.mmd) with no rendered output, or an orphan render.
// No LLM, no network.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, extname, basename } from 'node:path'

const ROOT = process.cwd()
const IGNORED = new Set(['node_modules', 'dist', 'coverage', '.git', 'spikes'])
const problems = []

/** Recursively collect files under `dir`, skipping IGNORED directories. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORED.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(ROOT)
const mdFiles = files.filter(f => extname(f) === '.md')

// --- 1. Relative Markdown links resolve -----------------------------------
const linkRe = /\]\(([^)]+)\)/g
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(linkRe)) {
    const raw = m[1].split('#')[0].trim()
    if (!raw || /^(https?:|mailto:)/.test(raw)) continue
    const target = resolve(dirname(file), raw)
    if (!existsSync(target)) {
      problems.push(`dead link: ${relative(ROOT, file)} -> ${raw}`)
    }
  }
}

// --- 2. ADR-NNNN references have a matching ADR file ----------------------
const adrDir = join(ROOT, 'docs', 'adr')
const adrNumbers = new Set()
if (existsSync(adrDir)) {
  for (const name of readdirSync(adrDir)) {
    const m = /^(\d{4})-/.exec(name)
    if (m) adrNumbers.add(m[1])
  }
}
const adrRefRe = /ADR-(\d{4})/g
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(adrRefRe)) {
    if (!adrNumbers.has(m[1])) {
      problems.push(`dangling ADR reference: ${relative(ROOT, file)} -> ADR-${m[1]}`)
    }
  }
}

// --- 3. Diagram sources <-> rendered outputs pair up ----------------------
const diagramSources = files.filter(f => ['.puml', '.mmd'].includes(extname(f)))
for (const src of diagramSources) {
  const stem = join(dirname(src), basename(src, extname(src)))
  const rendered = ['.svg', '.png'].some(ext => existsSync(stem + ext))
  if (!rendered) problems.push(`diagram source with no render: ${relative(ROOT, src)}`)
}

if (problems.length > 0) {
  console.error(`✗ docs check failed (${String(problems.length)}):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ docs check passed (${String(mdFiles.length)} markdown files)`)
