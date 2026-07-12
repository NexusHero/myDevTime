/**
 * Screenshot generator for the design-v3 three-persona user test.
 *
 * Reads `results.json` (produced by `harness.mjs` from the real `@mydevtime/domain`
 * core) and renders each persona's ACTUAL computed day on a token-accurate,
 * design-v3 bounded Day Canvas: the same phone screen at low / medium / hardcore
 * data density. It proves ADR-0035 (bounded screens — scroll depth does not grow
 * with workload) and shows the M4 overbooking surface (dropped anchors + an
 * "OHNE PLATZ" overflow shelf) on the hardcore profile.
 *
 * Tokens below are copied verbatim from `theme('light','blueprint')` — Blueprint
 * accent, light mode, signal palette (ADR-0034). Numerals use the mono face.
 *
 * Run after `harness.mjs`, from the repo root:
 *   node docs/design/user-tests/2026-07-12-design-v3/render.mjs
 * Writes lena-low.png, max-medium.png, hannes-hardcore.png and all-three.png here.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const results = JSON.parse(readFileSync(join(here, 'results.json'), 'utf8'))

const T = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  sunk: '#f1f5f9',
  ink: '#101828',
  ink2: '#475467',
  ink3: '#98a2b3',
  border: '#e5e9ef',
  borderStrong: '#cbd2dc',
  accent: '#2563eb',
  accentInk: '#ffffff',
  accentSoft: '#e9effd',
  live: '#ff5320',
  liveSoft: '#ffeae4',
  liveStrong: '#e33e0f',
  good: '#16a34a',
  goodSoft: '#e4f1e9',
  crit: '#c2372f',
  critSoft: '#f9ebea',
  proj: ['#00937c', '#6d5ae0', '#c23a62', '#2374bd', '#6e8523', '#bd7122'],
  ui: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  display: "'Space Grotesk', system-ui, sans-serif",
}

const hhmm = min =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const dur = min => (min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)}h ${min % 60}m`)

// A calm, honest hero-tracker per persona (Today shows the clock, never the Island).
const hero = {
  low: { running: false, elapsed: '00:00:00', label: 'Bereit — im Plan', proj: null },
  medium: { running: true, elapsed: '01:24:36', label: 'PROJ-142 Auth-Bug', proj: 3 },
  hardcore: { running: true, elapsed: '00:47:12', label: 'ADR Zahlungs-Rails', proj: 5 },
}
// Entry-list density (what a day of this profile accrues) — bounded to top 4 + "+N".
const entryCount = { low: 2, medium: 6, hardcore: 12 }

function blockRow(b) {
  if (b.kind === 'break') {
    return `<div class="blk brk"><span class="bt">${hhmm(b.startMin)}</span><span class="bl">Pause</span></div>`
  }
  if (b.kind === 'meeting') {
    return `<div class="blk mtg"><span class="bt">${hhmm(b.startMin)}</span>
      <span class="bl">${b.label}</span><span class="bd">${b.lenMin}m</span></div>`
  }
  return `<div class="blk foc"><span class="bt">${hhmm(b.startMin)}</span>
    <span class="bl"><b class="rk">${b.rank}</b> ${b.label}</span><span class="bd">${b.lenMin}m</span></div>`
}

function personaCol(r) {
  const h = hero[r.key]
  const dot = h.running ? `<span class="dot"></span>` : `<span class="play">▶</span>`
  const statusBg = h.running ? T.liveSoft : T.goodSoft
  const statusFg = h.running ? T.liveStrong : T.good

  // Bounded Day Canvas: show up to 6 blocks, rest behind "+N weitere".
  const LIMIT = 6
  const shown = r.blocks.slice(0, LIMIT)
  const hidden = r.blocks.length - shown.length
  const canvas =
    shown.map(blockRow).join('') +
    (hidden > 0 ? `<div class="more">+${hidden} weitere Blöcke</div>` : '')

  // M4: overbooking surface — dropped anchors + "OHNE PLATZ" overflow shelf.
  let warn = ''
  if (r.droppedAnchors.length > 0 || r.unplacedMin > 0) {
    const chips = r.droppedAnchors.map(a => `<span class="chip">${a}</span>`).join('')
    warn = `<div class="warn">
      <div class="warnhd">⚠ Tag überbucht</div>
      <div class="warnsub">${r.droppedAnchors.length} Termin(e) überlappen · ${dur(r.unplacedMin)} Backlog ohne Platz</div>
      <div class="shelf"><span class="shelfhd">OHNE PLATZ</span>${chips}</div>
    </div>`
  }

  // Entry list (bounded top-4 + "+N weitere").
  const n = entryCount[r.key]
  const sampleLabels = [
    'Fokus-Session',
    ...r.blocks.filter(b => b.kind === 'focus').map(b => b.label),
  ]
  const rows = Array.from({ length: Math.min(4, n) }, (_, i) => {
    const lbl = sampleLabels[i % sampleLabels.length] ?? 'Eintrag'
    const col = T.proj[(i + (r.key === 'hardcore' ? 4 : 0)) % T.proj.length]
    return `<div class="ent"><span class="sw" style="background:${col}"></span>
      <span class="el">${lbl}</span><span class="ev">${hhmm(30 + i * 37)}</span></div>`
  }).join('')
  const entMore = n > 4 ? `<div class="more">+${n - 4} weitere Einträge</div>` : ''

  return `<div class="col">
    <div class="phone">
      <div class="top">
        <span class="date">Sa · 12. Juli</span>
        <span class="who">${r.name}</span>
      </div>

      <div class="hero">
        <div class="tracker">
          <div class="tl">
            <div class="clock">${h.elapsed}</div>
            <div class="ctx">${h.label}</div>
          </div>
          <button class="ctl" style="background:${h.running ? T.live : T.accent}">${dot}</button>
        </div>
        <div class="status" style="background:${statusBg};color:${statusFg}">
          ${h.running ? 'läuft' : 'Im Plan'} · ${r.meetingsPlaced} Termine · ${dur(r.plannedFocusMin)} Fokus
        </div>
      </div>

      ${warn}

      <div class="canvashd">Co-Planner · dein Tag</div>
      <div class="canvas">${canvas}</div>

      <div class="canvashd">Einträge</div>
      <div class="entries">${rows}${entMore}</div>
    </div>
    <div class="caption">${r.name} — ${r.meetingsPlaced}/${r.anchorsIn} Termine · ${r.droppedAnchors.length} verworfen · ${r.unplacedMin} min ohne Platz</div>
  </div>`
}

const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${T.bg};font-family:${T.ui};padding:28px}
  .row{display:flex;gap:26px;align-items:flex-start}
  .col{display:flex;flex-direction:column;gap:10px;align-items:center}
  .phone{width:360px;background:${T.bg};border:1px solid ${T.borderStrong};border-radius:34px;padding:16px;
    box-shadow:0 18px 50px rgba(16,24,40,.12)}
  .top{display:flex;justify-content:space-between;align-items:baseline;padding:2px 4px 12px}
  .date{color:${T.ink3};font-size:12px;font-family:${T.mono}}
  .who{color:${T.ink};font-size:13px;font-weight:700;font-family:${T.display}}
  .hero{background:${T.surface};border:1px solid ${T.border};border-radius:20px;padding:16px;margin-bottom:10px}
  .tracker{display:flex;justify-content:space-between;align-items:center}
  .clock{font-family:${T.mono};font-size:34px;font-weight:600;color:${T.ink};letter-spacing:-1px}
  .ctx{font-size:12px;color:${T.ink2};margin-top:2px}
  .ctl{width:52px;height:52px;border-radius:999px;border:none;color:#fff;font-size:16px;cursor:default;
    display:flex;align-items:center;justify-content:center}
  .dot{width:12px;height:12px;border-radius:999px;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.35)}
  .play{color:#fff;font-size:15px;margin-left:2px}
  .status{margin-top:12px;font-size:11px;font-weight:700;padding:7px 12px;border-radius:999px;
    display:inline-block;font-family:${T.mono}}
  .warn{background:${T.critSoft};border:1px solid ${T.crit};border-radius:16px;padding:12px 14px;margin-bottom:10px}
  .warnhd{color:${T.crit};font-weight:800;font-size:13px}
  .warnsub{color:${T.ink2};font-size:11px;margin-top:3px}
  .shelf{display:flex;gap:6px;align-items:center;margin-top:9px;flex-wrap:wrap}
  .shelfhd{font-size:9px;font-weight:800;letter-spacing:.08em;color:${T.ink3};text-transform:uppercase}
  .chip{border:1px dashed ${T.borderStrong};color:${T.ink2};font-size:10px;padding:4px 9px;border-radius:999px;background:${T.surface}}
  .canvashd{font-size:10px;font-weight:800;letter-spacing:.08em;color:${T.ink3};text-transform:uppercase;
    margin:6px 4px 7px}
  .canvas{display:flex;flex-direction:column;gap:6px}
  .blk{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;font-size:12px}
  .blk .bt{font-family:${T.mono};font-size:10px;color:${T.ink3};min-width:34px}
  .blk .bl{flex:1;color:${T.ink};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .blk .bd{font-family:${T.mono};font-size:10px;color:${T.ink3}}
  .blk .rk{display:inline-block;background:${T.accent};color:#fff;border-radius:999px;font-size:9px;
    width:15px;height:15px;line-height:15px;text-align:center;font-family:${T.mono}}
  .mtg{background:${T.accentSoft};border:1px solid ${T.accent}22}
  .foc{background:${T.surface};border:1px solid ${T.border}}
  .brk{background:${T.sunk};color:${T.ink3}}
  .brk .bl{color:${T.ink3}}
  .more{font-size:11px;color:${T.accent};font-weight:700;padding:8px 4px 2px;font-family:${T.ui}}
  .entries{display:flex;flex-direction:column;gap:5px}
  .ent{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:10px;background:${T.surface};
    border:1px solid ${T.border};font-size:12px}
  .ent .sw{width:9px;height:9px;border-radius:3px}
  .ent .el{flex:1;color:${T.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ent .ev{font-family:${T.mono};font-size:10px;color:${T.ink2}}
  .caption{font-size:11px;color:${T.ink2};font-family:${T.mono};max-width:360px;text-align:center}
`

const cols = results.map(personaCol).join('')
const html = `<!doctype html><html><head><meta charset="utf8">
<style>${css}</style></head><body><div class="row">${cols}</div></body></html>`
writeFileSync(join(here, 'render.html'), html)

const require = createRequire('/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1300, height: 1500 },
  deviceScaleFactor: 2,
})
await page.goto('file://' + join(here, 'render.html'))
await page.waitForTimeout(300)
await page.screenshot({ path: join(here, 'all-three.png'), fullPage: true })
const names = { low: 'lena-low', medium: 'max-medium', hardcore: 'hannes-hardcore' }
const domCols = await page.$$('.col')
for (let i = 0; i < domCols.length; i++) {
  await domCols[i].screenshot({ path: join(here, `${names[results[i].key]}.png`) })
}
await browser.close()
console.log('screenshots written:', ['all-three', ...results.map(r => names[r.key])].join(', '))
