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

/* ---------- Profil: Abwesenheiten (Juli 2026, 1.7. = Mittwoch) ---------- */
export type AbsenceKind = 'vacation' | 'sick' | 'holiday'
export const absences: Record<number, AbsenceKind> = {
  2: 'sick', 3: 'sick',
  10: 'vacation',
  20: 'vacation', 21: 'vacation', 22: 'vacation', 23: 'vacation', 24: 'vacation',
}
export const TODAY_DATE = 9 // Do, 9. Juli 2026
export const allowance = { entitled: 30, taken: 3, planned: 6, sick: 2 }

/* ---------- Credits-Ledger (ADR-0008, #34) ---------- */
export interface LedgerEntry { label: string; when: string; delta: number }
export const creditBalance = 62
export const ledger: LedgerEntry[] = [
  { label: 'Co-Planer-Briefing', when: 'Heute 08:35', delta: -1 },
  { label: 'Meeting-Zusammenfassung „Daily Standup“', when: 'Heute 09:47', delta: -1 },
  { label: 'Wochen-Review generiert', when: 'So 18:02', delta: -1 },
  { label: 'Top-up-Paket (50)', when: '28.6.', delta: +50 },
  { label: 'Monats-Kontingent Pro', when: '1.7.', delta: +100 },
]

/* ---------- Regeln (#16) ---------- */
export interface Rule { id: string; name: string; cond: string; action: string; auto: boolean; hits: number; enabled: boolean }
export const rules: Rule[] = [
  { id: 'r1', name: 'Standups', cond: 'Kalender-Titel enthält „Standup“', action: '→ myDevTime App · nicht abrechenbar', auto: true, hits: 21, enabled: true },
  { id: 'r2', name: 'Finanzo-Termine', cond: 'Organisator endet auf @nexushero.de', action: '→ Finanzo Backend · abrechenbar', auto: false, hits: 8, enabled: true },
  { id: 'r3', name: 'Huber-Calls', cond: 'Titel enthält „Huber“ · Wochentag Di–Do', action: '→ Website-Relaunch · abrechenbar', auto: false, hits: 3, enabled: false },
]

/* ---------- Abend-Review (Plan vs. Ist, #40) ---------- */
export interface ReviewRow { title: string; state: 'kept' | 'moved' | 'longer' | 'dropped'; note: string }
export const reviewRows: ReviewRow[] = [
  { title: 'Code-Review PR #218', state: 'kept', note: 'wie geplant' },
  { title: 'Sync-Engine: Konflikt-Tests', state: 'longer', note: '+25 min länger als geplant' },
  { title: 'Angebot Huber nachfassen', state: 'moved', note: 'von 14:00 vorgezogen auf 11:30' },
  { title: 'Sync-Engine: Tombstones', state: 'dropped', note: 'entfallen — morgen erneut vorschlagen' },
]
export const standupDraft = `Gestern: Konflikt-Testsuite für die Sync-Engine erweitert, PR #218 reviewt.
Heute: Day-Canvas-Prototyp fertigstellen, danach Finanzo Sprint-Review (15:00).
Blocker: keine.`

/* ---------- Arbeitszeitnachweis (Auszug, #38) ---------- */
export interface SheetRow { date: string; from: string; to: string; brk: string; net: string; note?: string; flag?: boolean }
export const sheetRows: SheetRow[] = [
  { date: 'Mi 1.7.', from: '08:15', to: '17:05', brk: '0:45', net: '8:05' },
  { date: 'Do 2.7.', from: '—', to: '—', brk: '—', net: '—', note: 'Krank' },
  { date: 'Fr 3.7.', from: '—', to: '—', brk: '—', net: '—', note: 'Krank' },
  { date: 'Mo 6.7.', from: '08:28', to: '17:20', brk: '0:52', net: '8:00' },
  { date: 'Di 7.7.', from: '08:45', to: '18:10', brk: '0:30', net: '8:55' },
  { date: 'Mi 8.7.', from: '09:02', to: '19:26', brk: '0:30', net: '9:54', note: 'Pausenregel: 45 min fällig', flag: true },
  { date: 'Do 9.7.', from: '08:32', to: 'läuft', brk: '0:30', net: '—' },
]

/* ---------- Assistent (#20) ---------- */
export interface ChatMsg { role: 'user' | 'assistant'; text: string; links?: { label: string; view: string }[]; refusal?: boolean }
export const assistantScript: ChatMsg[] = [
  { role: 'user', text: 'Wie viele Stunden habe ich diesen Monat für Finanzo gearbeitet?' },
  {
    role: 'assistant',
    text: '31:00 h auf Finanzo Backend in diesem Monat, davon 28:30 h abrechenbar (≈ 3.135 €). Das Budget liegt bei 88 % — bei deinem Tempo ist es am 21.7. erschöpft.',
    links: [{ label: 'Berichte öffnen', view: 'reports' }, { label: 'Projekt ansehen', view: 'projects' }],
  },
  { role: 'user', text: 'Kann ich die Fahrten zum Kunden von der Steuer absetzen?' },
  {
    role: 'assistant',
    text: 'Dazu gebe ich keine Auskunft — ich beantworte nur Fragen zu deinen eigenen Zeit-, Projekt- und Meetingdaten in diesem Workspace. Für Steuerfragen wende dich an eine Steuerberatung.',
    refusal: true,
  },
]
