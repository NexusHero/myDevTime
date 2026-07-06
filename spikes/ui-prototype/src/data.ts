// Mock data + time helpers for the UI prototype. No backend, no persistence.
// Times are minutes since midnight of the demo day.

export type ProjectId = 'mdt' | 'finanzo' | 'huber' | 'intern' | 'oss'

export interface Project {
  id: ProjectId
  name: string
  client: string
  /** categorical slot 1..5 → --proj-1..--proj-5 (validated palette) */
  slot: 1 | 2 | 3 | 4 | 5
  rate: number
  budgetPct: number
  hoursMonth: number
  /** last 7 workdays, hours */
  trend: number[]
}

export type BlockKind = 'focus' | 'meeting' | 'admin'
export type BlockStatus = 'actual' | 'running' | 'ghost' | 'planned'

export interface Block {
  id: string
  title: string
  project?: ProjectId
  start: number
  end: number
  kind: BlockKind
  status: BlockStatus
  billable?: boolean
  hasTranscript?: boolean
  /** provenance chip text, e.g. "KI-Vorschlag" | "Regel: Standup" */
  source?: string
}

export interface BreakSpan {
  start: number
  end: number
}

export const projects: Project[] = [
  { id: 'mdt', name: 'myDevTime App', client: 'Eigenes Produkt', slot: 1, rate: 95, budgetPct: 62, hoursMonth: 46.5, trend: [5.5, 6.2, 4.8, 7.1, 5.9, 6.4, 5.2] },
  { id: 'finanzo', name: 'Finanzo Backend', client: 'NexusHero GmbH', slot: 2, rate: 110, budgetPct: 88, hoursMonth: 31.0, trend: [3.0, 2.5, 4.2, 3.8, 2.9, 4.5, 3.6] },
  { id: 'huber', name: 'Website-Relaunch', client: 'Huber & Söhne', slot: 3, rate: 85, budgetPct: 31, hoursMonth: 12.25, trend: [1.5, 0, 2.2, 1.8, 0, 2.5, 1.4] },
  { id: 'intern', name: 'Interne Tools', client: 'Eigenes Produkt', slot: 4, rate: 0, budgetPct: 0, hoursMonth: 6.5, trend: [0.5, 1.0, 0.8, 0.4, 1.2, 0.6, 0.9] },
  { id: 'oss', name: 'Open Source', client: 'Community', slot: 5, rate: 0, budgetPct: 0, hoursMonth: 3.75, trend: [0, 0.5, 0, 1.0, 0.5, 0.75, 0.5] },
]

export const projectById = (id?: ProjectId) => projects.find(p => p.id === id)

export const h = (hh: number, mm = 0) => hh * 60 + mm

/** Demo clock starts here and ticks live. */
export const DEMO_START = h(13, 37)

export const punchIn = h(8, 32)
export const initialBreaks: BreakSpan[] = [{ start: h(12, 30), end: h(13, 0) }]

export const initialBlocks: Block[] = [
  { id: 'b1', title: 'Code-Review PR #218', project: 'mdt', start: h(8, 40), end: h(9, 28), kind: 'focus', status: 'actual', billable: true },
  { id: 'b2', title: 'Daily Standup', project: 'mdt', start: h(9, 30), end: h(9, 45), kind: 'meeting', status: 'actual', hasTranscript: true, source: 'Kalender' },
  { id: 'b3', title: 'Sync-Engine: Konflikt-Tests', project: 'mdt', start: h(9, 50), end: h(11, 20), kind: 'focus', status: 'actual', billable: true },
  { id: 'b4', title: 'Angebot Huber nachfassen', project: 'huber', start: h(11, 30), end: h(12, 10), kind: 'admin', status: 'actual', billable: false },
  { id: 'b5', title: 'Day-Canvas-Prototyp', project: 'mdt', start: h(13, 5), end: DEMO_START, kind: 'focus', status: 'running', billable: true },
  // Fixed meeting later today (from calendar)
  { id: 'b6', title: 'Finanzo Sprint-Review', project: 'finanzo', start: h(15, 0), end: h(16, 0), kind: 'meeting', status: 'planned', source: 'Kalender' },
  // Co-Planner proposals for the rest of the day (ghost blocks)
  { id: 'g1', title: 'Sync-Engine: Tombstones', project: 'mdt', start: h(13, 45), end: h(14, 50), kind: 'focus', status: 'ghost', billable: true, source: 'KI-Vorschlag' },
  { id: 'g2', title: 'Doku REQ-025 Transkripte', project: 'finanzo', start: h(16, 10), end: h(17, 0), kind: 'focus', status: 'ghost', billable: true, source: 'KI-Vorschlag' },
]

export interface Meeting {
  id: string
  title: string
  time: string
  project: ProjectId
  duration: string
  state: 'insights' | 'transcript' | 'upcoming'
  summary?: string[]
  actions?: string[]
}

export const meetings: Meeting[] = [
  {
    id: 'm1', title: 'Daily Standup', time: 'Heute 09:30', project: 'mdt', duration: '15 min', state: 'insights',
    summary: [
      'Sync-Engine: Konflikt-Testsuite läuft, Tombstone-Fälle offen.',
      'Day-Canvas-Prototyp heute im Fokus, Review morgen.',
      'Blocker: keiner.',
    ],
    actions: ['Tombstone-Sync-Fälle spezifizieren', 'Prototyp-Link an Team schicken'],
  },
  {
    id: 'm2', title: 'Finanzo Sprint-Review', time: 'Heute 15:00', project: 'finanzo', duration: '60 min', state: 'upcoming',
  },
  {
    id: 'm3', title: 'Huber: Feedback Startseite', time: 'Gestern 14:00', project: 'huber', duration: '45 min', state: 'transcript',
  },
]

/** Week bars: Mo–So, billable/non-billable hours (deterministic demo data). */
export const weekHours = [
  { day: 'Mo', billable: 5.5, rest: 1.5 },
  { day: 'Di', billable: 6.0, rest: 1.0 },
  { day: 'Mi', billable: 4.5, rest: 2.0 },
  { day: 'Do', billable: 5.0, rest: 1.2 }, // today, so far
  { day: 'Fr', billable: 0, rest: 0 },
  { day: 'Sa', billable: 0, rest: 0 },
  { day: 'So', billable: 0, rest: 0 },
]

/** 12 weeks × Mo–Fr intensity 0..1 for the heatmap. */
export const heat: number[][] = [
  [0.7, 0.9, 0.6, 0.8, 0.3],
  [0.8, 0.7, 0.9, 0.6, 0.4],
  [0.5, 0.8, 0.7, 0.9, 0.5],
  [0.9, 0.6, 0.8, 0.7, 0.2],
  [0.6, 0.9, 0.5, 0.8, 0.6],
  [0.7, 0.5, 0.9, 0.6, 0.3],
  [0.8, 0.8, 0.6, 0.9, 0.4],
  [0.4, 0.7, 0.8, 0.5, 0.7],
  [0.9, 0.8, 0.7, 0.6, 0.3],
  [0.6, 0.7, 0.9, 0.8, 0.5],
  [0.7, 0.9, 0.8, 0.7, 0.4],
  [0.5, 0.6, 0.4, 0.55, 0],
]

export const fmtClock = (min: number) => {
  const m = Math.floor(min)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const fmtDur = (min: number) => {
  const m = Math.round(min)
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')} h` : `${mm} min`
}

export const fmtHours = (hours: number) => {
  const m = Math.round(hours * 60)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Tiny NL parser for the palette demo: "45m Code Review", "2h Doku gestern", "1:30 Finanzo Review". */
export function parseQuickEntry(input: string): { minutes: number; title: string; yesterday: boolean; project?: ProjectId } | null {
  const m = input.match(/^\s*(\d+(?:[.,:]\d+)?)\s*(h|std|m|min)?\s+(.{2,})$/i)
  if (!m) return null
  const numRaw = m[1].replace(',', '.')
  let minutes: number
  if (numRaw.includes(':')) {
    const [hh, mm] = numRaw.split(':')
    minutes = parseInt(hh, 10) * 60 + parseInt(mm || '0', 10)
  } else {
    const val = parseFloat(numRaw)
    const unit = (m[2] || (val <= 12 ? 'h' : 'm')).toLowerCase()
    minutes = unit.startsWith('h') || unit === 'std' ? Math.round(val * 60) : Math.round(val)
  }
  let title = m[3].trim()
  const yesterday = /\bgestern\b/i.test(title)
  title = title.replace(/\bgestern\b/gi, '').replace(/\s+/g, ' ').trim()
  const lower = title.toLowerCase()
  const project = projects.find(p => lower.includes(p.name.split(' ')[0].toLowerCase()) || lower.includes(p.id))?.id
  if (minutes <= 0 || minutes > 12 * 60 || !title) return null
  return { minutes, title, yesterday, project }
}
