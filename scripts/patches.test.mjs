// Regression tests for the dependency patches in `patches/` (applied by pnpm via
// `pnpm.patchedDependencies`). Each one backports a security fix that upstream only
// shipped in a release our dependency tree cannot take; the test proves the patch
// is actually installed and still behaves like the version it replaces.

import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PNPM_STORE = join(import.meta.dirname, '..', 'node_modules', '.pnpm')

/**
 * The copies of `name` that its real consumers load: resolved from each installed
 * `consumer` exactly as Node/Metro would, so a stale unpatched folder in the store
 * cannot stand in for the one actually shipped.
 */
function resolvedThrough(consumer, name) {
  const paths = readdirSync(PNPM_STORE)
    .filter(dir => dir.startsWith(`${consumer}@`))
    .map(dir => createRequire(join(PNPM_STORE, dir, 'node_modules', consumer, 'package.json')))
    .map(requireFrom => requireFrom.resolve(name))
  return [...new Set(paths)]
}

// decode-uri-component@0.2.2 — GHSA-vcc3-ghjq-m6fr (CVE-2026-45822): the fallback
// decoder is cubic in the number of malformed `%XX` tokens. The fix (0.5.0) is
// ESM-only, which query-string@7 (react-navigation, expo-router — shipped in the web
// bundle) cannot `require`. Backported as patches/decode-uri-component@0.2.2.patch.
const decodeUriCopies = resolvedThrough('query-string', 'decode-uri-component')

it('finds the decode-uri-component copies query-string loads', () => {
  expect(decodeUriCopies.length).toBeGreaterThan(0)
})

describe.each(decodeUriCopies)('decode-uri-component at %s', file => {
  const decode = createRequire(import.meta.url)(file)

  it('decodes malformed input in linear time (GHSA-vcc3-ghjq-m6fr)', () => {
    // Unpatched, 400 repetitions already take ~2 s (cubic); 600 take ~7 s.
    const hostile = '%FF'.repeat(600)

    const started = performance.now()
    decode(hostile)

    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it('decodes many distinct percent-encoded runs in linear time (GHSA-qr28-fpjm-wq7f)', () => {
    // 0.5.0 replaced each distinct run with its own whole-input regex pass — quadratic:
    // 20 000 distinct 3-byte runs + one invalid byte (forces the fallback) took ~1.6 s,
    // 40 000 ~7.5 s. Linear, 20 000 take a few milliseconds.
    let hostile = '%FF'
    for (let cp = 0x800; cp < 0x800 + 20_000; cp += 1) {
      hostile += `${encodeURIComponent(String.fromCodePoint(cp))}-`
    }

    const started = performance.now()
    const decoded = decode(hostile)

    expect(performance.now() - started).toBeLessThan(500)
    expect(decoded.startsWith('%FF\u0800-\u0801-')).toBe(true)
  })

  it.each([
    ['plain text', 'plain text'],
    ['a+b', 'a b'],
    ['%E2%9C%93', '✓'],
    ['%', '%'],
    ['%%', '%%'],
    ['st%C3%A5le', 'ståle'],
    ['%E0%A4%A', '%E0%A4%A'],
    ['%FE%FF', '��'],
    ['%C2', '�'],
    ['%C2x', '�x'],
    ['%FF%FE', '��'],
    ['%C3%A5%C2', 'å�'],
    ['%FFst%C3%A5le%C2', '%FFståle�'],
  ])('keeps the 0.2.2 behaviour: %j → %j', (input, expected) => {
    expect(decode(input)).toBe(expected)
  })

  it('rejects a non-string like 0.2.2 did', () => {
    expect(() => decode(42)).toThrow(TypeError)
  })
})
