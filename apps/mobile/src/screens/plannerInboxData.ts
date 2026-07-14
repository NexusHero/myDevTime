import type { Priority } from '@mydevtime/design'

/**
 * Deterministic demo data for the Planner **Task-Inbox** (design v6): assigned
 * Jira/Linear/GitHub tickets land here, not in the calendar. "Planen" drops the
 * ticket into the next free slot as a ghost (a proposal — ADR-0005). No live
 * connector feeds this yet, so the rail is a labelled preview (M7).
 */

export type TaskSource = 'Jira' | 'Linear' | 'GitHub'
export type TaskTag = 'Bug' | 'Feature' | 'Review'

export interface InboxTask {
  readonly key: string
  readonly title: string
  /** Estimate in hours. */
  readonly est: number
  readonly prio: Priority
  readonly tag: TaskTag
  /** Index into `INBOX_PROJECTS`. */
  readonly project: number
  readonly src: TaskSource
  readonly desc: string
  readonly due?: string
  /** Days until due (for the deadline tone). */
  readonly dueIn?: number
}

export interface InboxProject {
  readonly name: string
  /** Project id → deterministic color (FNV-1a). */
  readonly id: string
}

export const INBOX_PROJECTS: readonly InboxProject[] = [
  { name: 'Finanzo AG', id: 'finanzo' },
  { name: 'Sync engine', id: 'sync-engine' },
  { name: 'Nordwind GmbH', id: 'nordwind' },
  { name: 'Atlas Relaunch', id: 'reviews' },
]

export const INBOX_TASKS: readonly InboxTask[] = [
  {
    key: 'FIN-231',
    title: 'SEPA-Export: Sammellastschrift',
    est: 2,
    prio: 1,
    tag: 'Feature',
    project: 0,
    due: '10.7.',
    dueIn: 2,
    src: 'Jira',
    desc: 'Sammellastschriften als SEPA-XML (pain.008) exportieren. Validierung gegen Schema, Mandatsreferenz prüfen.',
  },
  {
    key: 'FIN-228',
    title: 'Rundungsfehler Rechnungssumme',
    est: 1,
    prio: 1,
    tag: 'Bug',
    project: 0,
    due: '9.7.',
    dueIn: 1,
    src: 'Jira',
    desc: 'Bei 3+ Positionen mit 19%/7% MwSt weicht die Summe um 1 Cent ab. Rundung pro Position statt pro Rechnung.',
  },
  {
    key: 'FIN-224',
    title: 'Audit-Log für Buchungen',
    est: 3,
    prio: 2,
    tag: 'Feature',
    project: 0,
    src: 'Jira',
    desc: 'Jede Buchungsänderung revisionssicher loggen (wer, wann, was). Export für Wirtschaftsprüfer.',
  },
  {
    key: 'FIN-219',
    title: 'PR #412 reviewen',
    est: 0.5,
    prio: 2,
    tag: 'Review',
    project: 0,
    src: 'GitHub',
    desc: 'Refactoring des Invoice-Service — 400 Zeilen, 2 offene Kommentare vom Autor.',
  },
  {
    key: 'FIN-215',
    title: 'Mandanten-Import CSV',
    est: 2,
    prio: 3,
    tag: 'Feature',
    project: 0,
    src: 'Jira',
    desc: 'CSV-Import mit Spalten-Mapping-UI und Dubletten-Erkennung.',
  },
  {
    key: 'SYNC-142',
    title: 'Conflict resolution: CRDT merge',
    est: 3,
    prio: 1,
    tag: 'Feature',
    project: 1,
    due: '11.7.',
    dueIn: 3,
    src: 'Linear',
    desc: 'Merge-Strategie für konkurrierende Edits: LWW-Register durch CRDT-Sequenz ersetzen.',
  },
  {
    key: 'SYNC-139',
    title: 'Offline-Queue läuft voll',
    est: 1.5,
    prio: 1,
    tag: 'Bug',
    project: 1,
    due: '9.7.',
    dueIn: 1,
    src: 'Linear',
    desc: 'Queue wächst unbegrenzt bei >2h offline. Kompaktierung + Obergrenze einziehen.',
  },
  {
    key: 'SYNC-137',
    title: 'Retry-Backoff konfigurierbar',
    est: 1,
    prio: 2,
    tag: 'Feature',
    project: 1,
    src: 'Linear',
    desc: 'Exponentielles Backoff mit Jitter, per Config übersteuerbar.',
  },
  {
    key: 'SYNC-133',
    title: 'PR #98 reviewen',
    est: 0.5,
    prio: 2,
    tag: 'Review',
    project: 1,
    src: 'GitHub',
    desc: 'Delta-Encoding für Sync-Payloads.',
  },
  {
    key: 'NW-87',
    title: 'Login: SSO via Entra ID',
    est: 3,
    prio: 1,
    tag: 'Feature',
    project: 2,
    due: '17.7.',
    dueIn: 9,
    src: 'Jira',
    desc: 'OIDC-Flow gegen Entra ID, Gruppen-Mapping auf Rollen, Fallback lokaler Login.',
  },
  {
    key: 'NW-85',
    title: 'Report-PDF: Umlaute kaputt',
    est: 0.75,
    prio: 2,
    tag: 'Bug',
    project: 2,
    src: 'Jira',
    desc: 'Font-Subsetting verliert ä/ö/ü bei eingebetteten Schriften.',
  },
  {
    key: 'NW-79',
    title: 'PR #201 reviewen',
    est: 0.5,
    prio: 3,
    tag: 'Review',
    project: 2,
    src: 'GitHub',
    desc: 'Kleines Refactoring im Report-Modul.',
  },
  {
    key: '#41',
    title: 'Lighthouse: LCP > 4s mobil',
    est: 1.5,
    prio: 1,
    tag: 'Bug',
    project: 3,
    due: '10.7.',
    dueIn: 2,
    src: 'GitHub',
    desc: 'Hero-Bild unoptimiert, kein Preload. Ziel: LCP < 2,5s.',
  },
  {
    key: '#39',
    title: 'Navigation: Mega-Menu A11y',
    est: 1,
    prio: 2,
    tag: 'Bug',
    project: 3,
    src: 'GitHub',
    desc: 'Fokus-Falle + fehlende aria-expanded-Attribute.',
  },
  {
    key: '#33',
    title: 'Bildpipeline auf AVIF',
    est: 2,
    prio: 3,
    tag: 'Feature',
    project: 3,
    src: 'GitHub',
    desc: 'Build-Step: AVIF + WebP-Fallback generieren.',
  },
]

export const INBOX_TAGS: readonly (TaskTag | 'Alle')[] = ['Alle', 'Bug', 'Feature', 'Review']
export const INBOX_SOURCES: readonly (TaskSource | 'Alle')[] = ['Alle', 'Jira', 'Linear', 'GitHub']
export type InboxSort = 'prio' | 'due' | 'est' | 'src'

/** The sort comparators, deterministic with a stable priority tie-break. */
export const INBOX_SORTERS: Record<InboxSort, (a: InboxTask, b: InboxTask) => number> = {
  prio: (a, b) => a.prio - b.prio || b.est - a.est,
  due: (a, b) => (a.dueIn ?? 99) - (b.dueIn ?? 99) || a.prio - b.prio,
  est: (a, b) => b.est - a.est || a.prio - b.prio,
  src: (a, b) => a.src.localeCompare(b.src) || a.prio - b.prio,
}
