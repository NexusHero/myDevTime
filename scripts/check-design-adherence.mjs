#!/usr/bin/env node
// Deterministic design-adherence gate (design v7 `_adherence.oxlintrc.json`,
// ADR-0054). The design tool ships adherence rules for its web JSX prototypes
// (no raw hex / px / off-system fonts, import components from the index). Most
// don't map to our React-Native client — RN StyleSheet uses unitless numbers,
// not `px`; fonts and colors already flow through the `@mydevtime/design` theme.
// The one rule that transfers is: **colors come from the theme, not raw hex.**
//
// Rather than a big-bang refactor of the existing raw-hex uses (risky to do
// blind, without a visual check), this is a **ratchet**: today's known uses are
// captured in `design-adherence-baseline.json`, and the gate fails only when a
// file introduces *more* raw hex than its baseline. New drift is blocked; the
// baseline is burn-down debt — lower it whenever you replace a hex with a token
// (`useTheme().color.*`). No LLM, no network.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIR = join(ROOT, 'apps', 'mobile', 'src')
const BASELINE = join(ROOT, 'scripts', 'design-adherence-baseline.json')
// A raw hex colour string literal: '#fff' | "#101828" | '#ff8a5cff' …
const HEX = /['"]#[0-9a-fA-F]{3,8}['"]/g

/** Recursively collect non-test .ts/.tsx sources under `dir`. */
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      sources(full, out)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
const counts = {}
if (existsSync(SCAN_DIR)) {
  for (const file of sources(SCAN_DIR)) {
    const n = (readFileSync(file, 'utf8').match(HEX) ?? []).length
    if (n > 0) counts[relative(ROOT, file).replaceAll('\\', '/')] = n
  }
}

const grew = [] // files that added raw hex beyond their baseline
const loosenable = [] // files that dropped below baseline — tighten the baseline
for (const [file, n] of Object.entries(counts)) {
  const allowed = baseline[file] ?? 0
  if (n > allowed) grew.push(`${file}: ${String(n)} raw-hex colours (baseline ${String(allowed)})`)
}
for (const [file, allowed] of Object.entries(baseline)) {
  const n = counts[file] ?? 0
  if (n < allowed) loosenable.push(`${file}: now ${String(n)} (baseline ${String(allowed)})`)
}

if (grew.length > 0) {
  console.error(`✗ design-adherence check failed (${String(grew.length)}):`)
  for (const g of grew) console.error(`  - ${g}`)
  console.error('\n  Colours must come from the theme: useTheme().color.* (see packages/design).')
  console.error('  If a new raw hex is truly unavoidable, raise its count in')
  console.error('  scripts/design-adherence-baseline.json with a comment saying why.')
  process.exit(1)
}

const total = Object.values(counts).reduce((a, n) => a + n, 0)
if (loosenable.length > 0) {
  console.log(`✓ design-adherence check passed (${String(total)} baselined raw-hex uses)`)
  console.log('  ↓ these files dropped below their baseline — tighten it (debt burn-down):')
  for (const l of loosenable) console.log(`    - ${l}`)
} else {
  console.log(
    `✓ design-adherence check passed (${String(total)} baselined raw-hex uses, no new drift)`,
  )
}
