#!/usr/bin/env node
// Render every inline Mermaid diagram in docs/**/*.md to a committed SVG so the
// diagrams are visible in PDF/other viewers, not just on GitHub — while the
// Mermaid source stays the single source of truth inside the doc.
//
// Default run (`node scripts/gen-diagrams.mjs` / `pnpm diagrams`):
//   1. scans docs/**/*.md, extracts each ```mermaid block in document order,
//   2. renders it to docs/diagrams/<doc-slug>-<n>.svg (deterministic names) via
//      mmdc, pointed at the pre-installed Chromium (scripts/mermaid/puppeteer.json),
//   3. stamps each SVG with a `<!-- mermaid-src:sha256:… -->` marker of the exact
//      source it was rendered from,
//   4. normalises the doc so each block shows the SVG image first, with the
//      editable Mermaid source kept in a <details> block right after (idempotent).
//
// `--check` (`pnpm check:diagrams`, the ./test.sh + CI gate):
//   for every ```mermaid block, hashes the current source and asserts the committed
//   docs/diagrams/*.svg carries the matching marker — plus flags missing renders and
//   orphan SVGs. Exits non-zero on any drift. Deterministic and Chromium-free.
//
//   Why a source hash and not a byte diff of a re-render: two of the large fan-out
//   flowcharts (docs/use-cases.md) have non-deterministic dagre edge routing — the
//   same source renders with edge splines shifted by a few pixels run-to-run — so a
//   byte-for-byte re-render diff would be permanently flaky. The hash marker gates
//   the drift we actually care about (source edited, SVG not regenerated) exactly,
//   and without launching a browser in CI.
//
// No LLM, no network. mmdc must not download a browser: PUPPETEER_SKIP_DOWNLOAD is
// forced and the puppeteer config points at the pre-installed Chromium.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { join, dirname, relative, extname, basename, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'docs')
const DIAGRAMS = join(DOCS, 'diagrams')
const HERE = dirname(fileURLToPath(import.meta.url))
const MMDC = join(ROOT, 'node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js')
const PUPPETEER_CFG = join(HERE, 'mermaid', 'puppeteer.json')
const MERMAID_CFG = join(HERE, 'mermaid', 'config.json')
const CHECK = process.argv.includes('--check')

const IGNORED = new Set(['node_modules', 'dist', 'coverage', '.git', 'spikes', 'diagrams'])
const MARKER_RE = /<!-- mermaid-src:sha256:([0-9a-f]{64}) -->/

/** Recursively collect .md files under `dir`, skipping IGNORED directories. */
function walkMd(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORED.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkMd(full, out)
    else if (extname(full) === '.md') out.push(full)
  }
  return out
}

/** docs/security/hardening.md -> "security-hardening" (path slug, stable). */
function docSlug(file) {
  return relative(DOCS, file).slice(0, -extname(file).length).split(sep).join('-')
}

const sha256 = s => createHash('sha256').update(s).digest('hex')

// A managed region is either a bare ```mermaid fence or one already wrapped by a
// previous run (image + <details> … </details>). Matching both keeps the rewrite
// idempotent. Non-greedy body stops at the first closing fence.
const BLOCK_RE =
  /(?:!\[[^\]]*\]\([^\n)]*\)\n\n<details>\n<summary>Mermaid source<\/summary>\n\n)?```mermaid\n([\s\S]*?)\n```(?:\n\n<\/details>)?/g

const HEADING_RE = /^#{1,6}\s+(.*)$/gm

/** Nearest Markdown heading text at or before `index` (for the image alt text). */
function nearestHeading(text, index) {
  let title = ''
  for (const m of text.matchAll(HEADING_RE)) {
    if (m.index > index) break
    title = m[1].replace(/\s*\{#[^}]*\}\s*$/, '').trim()
  }
  return title
}

/** Collect every mermaid block in a doc: { code, svgName, alt, relImg }. */
function blocksOf(file, text) {
  const slug = docSlug(file)
  const relToDiagrams = relative(dirname(file), DIAGRAMS).split(sep).join('/')
  const blocks = []
  let n = 0
  for (const m of text.matchAll(BLOCK_RE)) {
    n += 1
    const svgName = `${slug}-${String(n)}.svg`
    const heading = nearestHeading(text, m.index)
    const alt = heading ? `${heading} — diagram` : `${slug} diagram ${String(n)}`
    blocks.push({ code: m[1], svgName, alt, relImg: `${relToDiagrams}/${svgName}` })
  }
  return blocks
}

/** Render one mermaid source to `outSvg` via mmdc + pinned Chromium, then stamp it. */
function render(code, outSvg) {
  const tmp = mkdtempSync(join(tmpdir(), 'mmd-'))
  const inMmd = join(tmp, 'in.mmd')
  writeFileSync(inMmd, code.endsWith('\n') ? code : code + '\n')
  try {
    execFileSync(
      process.execPath,
      [
        MMDC,
        '-i',
        inMmd,
        '-o',
        outSvg,
        '-p',
        PUPPETEER_CFG,
        '-c',
        MERMAID_CFG,
        '-b',
        'transparent',
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' },
      },
    )
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : String(err.message)
    const parse = stderr.split('\n').find(l => l.includes('Error:')) ?? stderr.trim().split('\n')[0]
    throw new Error(`mmdc failed to render ${basename(outSvg)}: ${parse}`, { cause: err })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  const svg = readFileSync(outSvg, 'utf8').replace(/\s*$/, '')
  writeFileSync(outSvg, `${svg}\n<!-- mermaid-src:sha256:${sha256(code)} -->\n`)
}

/** Canonical embed: SVG image first, editable Mermaid source in a <details>. */
function embed(block) {
  return (
    `![${block.alt}](${block.relImg})\n\n` +
    `<details>\n<summary>Mermaid source</summary>\n\n` +
    '```mermaid\n' +
    `${block.code}\n` +
    '```\n\n' +
    `</details>`
  )
}

function generate(files) {
  if (!existsSync(DIAGRAMS)) mkdirSync(DIAGRAMS, { recursive: true })
  let total = 0
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const blocks = blocksOf(file, text)
    if (blocks.length === 0) continue
    for (const b of blocks) {
      total += 1
      render(b.code, join(DIAGRAMS, b.svgName))
    }
    const queue = blocks.slice()
    const rewritten = text.replace(BLOCK_RE, (_full, code) => embed({ ...queue.shift(), code }))
    if (rewritten !== text) writeFileSync(file, rewritten)
  }
  console.log(
    `✓ rendered ${String(total)} diagrams to docs/diagrams/ and synced ${String(files.length)} docs`,
  )
}

function check(files) {
  const problems = []
  const committed = existsSync(DIAGRAMS)
    ? new Set(readdirSync(DIAGRAMS).filter(f => extname(f) === '.svg'))
    : new Set()
  let total = 0
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const b of blocksOf(file, text)) {
      total += 1
      committed.delete(b.svgName)
      const svgPath = join(DIAGRAMS, b.svgName)
      const rel = `docs/diagrams/${b.svgName}`
      if (!existsSync(svgPath)) {
        problems.push(`missing render: ${rel} (from ${relative(ROOT, file)})`)
        continue
      }
      const marker = MARKER_RE.exec(readFileSync(svgPath, 'utf8'))
      if (!marker) problems.push(`unstamped SVG (regenerate): ${rel}`)
      else if (marker[1] !== sha256(b.code))
        problems.push(`drift: ${rel} is stale for the current Mermaid source`)
    }
  }
  for (const orphan of committed)
    problems.push(`orphan SVG (no source block): docs/diagrams/${orphan}`)
  if (problems.length > 0) {
    console.error(`✗ diagram check failed (${String(problems.length)}):`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error('  run `pnpm diagrams` and commit docs/diagrams/*.svg')
    process.exit(1)
  }
  console.log(`✓ diagram check passed (${String(total)} diagrams in sync, no drift)`)
}

function main() {
  if (!existsSync(MMDC)) {
    console.error('✗ @mermaid-js/mermaid-cli not installed — run `pnpm install` first.')
    process.exit(1)
  }
  const files = walkMd(DOCS).sort()
  if (CHECK) check(files)
  else generate(files)
}

main()
