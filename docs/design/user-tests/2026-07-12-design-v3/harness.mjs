/**
 * Three-persona user-test harness (design v3) — DETERMINISTIC, no secrets.
 *
 * Drives the REAL product core (`@mydevtime/domain`) for three workload profiles
 * — Lena (Low), Max (Medium), Hannes (Hardcore) — and prints the numbers the
 * report is built from: how the Co-Planner places meetings, which anchors it
 * drops when overbooked (M4), how much backlog does not fit, and how the NL
 * quick-add parses each persona's phrases.
 *
 * Unlike the original scratchpad harness (which called live Gemini and kept its
 * key out of the repo), this one is fully deterministic: it exercises only the
 * pure, exhaustively-tested core (ADR-0005), so it is reproducible by anyone and
 * safe to commit. The AI garnish is represented by `deterministicLabels` — the
 * exact graceful-degradation path the LLM labeler falls back to when no provider
 * is configured.
 *
 * Run from the repo root after `pnpm --filter @mydevtime/domain build`:
 *   node docs/design/user-tests/2026-07-12-design-v3/harness.mjs
 * It writes `results.json` next to this file (the report cites those numbers).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildDayPlan,
  deterministicLabels,
  parseTimeEntry,
} from '../../../../packages/domain/dist/index.js'

const H = (h, m = 0) => h * 60 + m
const here = dirname(fileURLToPath(import.meta.url))

const personas = [
  {
    key: 'low',
    name: 'Lena (Low)',
    note: 'Freelancerin, trackt gelegentlich, wenige Termine, keine Integrationen.',
    plan: {
      dayStartMin: H(9),
      dayEndMin: H(17),
      anchors: [{ startMin: H(9, 30), lenMin: 30, label: 'Kurzes Kundengespräch' }],
      backlog: [
        { id: 'logo', label: 'Logo-Feinschliff', estimateMin: 120, priority: 1 },
        { id: 'mail', label: 'Angebote schreiben', estimateMin: 60, priority: 2 },
      ],
    },
    nlPhrases: ['2h logo feinschliff', 'kaffee mit kunde'],
  },
  {
    key: 'medium',
    name: 'Max (Medium)',
    note: 'Angestellter Dev, Jira verbunden, schaut hin und wieder rein, moderate Last.',
    plan: {
      dayStartMin: H(8, 30),
      dayEndMin: H(17, 30),
      anchors: [
        { startMin: H(9), lenMin: 15, label: 'Daily Standup' },
        { startMin: H(11), lenMin: 60, label: 'Sprint Refinement (Jira)' },
        { startMin: H(14), lenMin: 30, label: 'Review Call' },
      ],
      backlog: [
        { id: 'PROJ-142', label: 'PROJ-142 Auth-Bug', estimateMin: 120, priority: 1 },
        { id: 'PROJ-150', label: 'PROJ-150 Sync-Feature', estimateMin: 150, priority: 2 },
        { id: 'reviews', label: 'Code Reviews', estimateMin: 60, priority: 3 },
      ],
    },
    nlPhrases: ['1,5h PROJ-142 auth bug gestern', '30min review call'],
  },
  {
    key: 'hardcore',
    name: 'Hannes (Hardcore)',
    note: 'Lead, ÜBERBUCHT: überlappende Termine (3 im selben Slot), alle Integrationen, hoher Stress.',
    plan: {
      dayStartMin: H(8),
      dayEndMin: H(19),
      anchors: [
        { startMin: H(9), lenMin: 30, label: 'Standup' },
        // Overbooked slot: three meetings competing for 10:00–11:30.
        { startMin: H(10), lenMin: 60, label: 'Architektur-Review' },
        { startMin: H(10), lenMin: 60, label: '1:1 mit CTO' },
        { startMin: H(10, 30), lenMin: 60, label: 'Incident-Bridge (P1)' },
        { startMin: H(12), lenMin: 60, label: 'Vendor Call' },
        { startMin: H(13), lenMin: 90, label: 'Roadmap Workshop' },
        { startMin: H(15), lenMin: 60, label: 'Interview Kandidat' },
        { startMin: H(16, 30), lenMin: 60, label: 'Board Prep' },
      ],
      backlog: [
        { id: 'ARCH', label: 'ADR Zahlungs-Rails', estimateMin: 180, priority: 1 },
        { id: 'PROD', label: 'Prod-Incident Nacharbeit', estimateMin: 120, priority: 2 },
        { id: 'HIRE', label: 'Hiring-Feedback', estimateMin: 60, priority: 3 },
        { id: 'OKR', label: 'OKR-Draft Q3', estimateMin: 120, priority: 4 },
        { id: 'REV', label: 'Reviews', estimateMin: 90, priority: 5 },
      ],
    },
    nlPhrases: ['3h ADR zahlungs-rails', 'incident bridge 45min'],
  },
]

const results = personas.map(p => {
  const plan = buildDayPlan(p.plan)
  const meetings = plan.blocks.filter(b => b.kind === 'meeting').length
  const focus = plan.blocks.filter(b => b.kind === 'focus').length
  const breaks = plan.blocks.filter(b => b.kind === 'break').length
  const labels = deterministicLabels(plan)
  const nl = p.nlPhrases.map(phrase => {
    const d = parseTimeEntry(phrase)
    return {
      phrase,
      parsed: d
        ? {
            durationMin: Math.round(d.durationMs / 60000),
            projectHint: d.projectHint,
            dayOffset: d.dayOffset,
            billable: d.billable,
          }
        : null,
    }
  })

  console.log('\n' + '='.repeat(72))
  console.log(`${p.name} — ${p.note}`)
  console.log('='.repeat(72))
  console.log(
    `[Plan] anchors in=${p.plan.anchors.length}  placed=${meetings}  dropped=${plan.droppedAnchors.length}` +
      `  focus=${focus}  break=${breaks}`,
  )
  console.log(`[Plan] plannedFocusMin=${plan.plannedFocusMin}  unplacedMin=${plan.unplacedMin}`)
  if (plan.droppedAnchors.length > 0) {
    console.log(`[Plan] dropped: ${plan.droppedAnchors.map(a => a.label).join(', ')}`)
  }
  for (const { phrase, parsed } of nl) {
    console.log(
      `[NL] "${phrase}" -> ` +
        (parsed
          ? `${parsed.durationMin}min proj=${parsed.projectHint ?? '-'} (deterministic)`
          : 'NULL -> LLM fallback would run'),
    )
  }

  return {
    key: p.key,
    name: p.name,
    note: p.note,
    dayStartMin: plan.dayStartMin,
    dayEndMin: plan.dayEndMin,
    anchorsIn: p.plan.anchors.length,
    meetingsPlaced: meetings,
    droppedAnchors: plan.droppedAnchors.map(a => a.label),
    focusBlocks: focus,
    breakBlocks: breaks,
    plannedFocusMin: plan.plannedFocusMin,
    unplacedMin: plan.unplacedMin,
    blocks: plan.blocks.map((b, i) => ({
      i,
      kind: b.kind,
      label: b.label,
      startMin: b.startMin,
      lenMin: b.lenMin,
      rank: labels[i].rank,
    })),
    nl,
  }
})

writeFileSync(join(here, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log('\nWrote results.json')
