import type { Priority } from '@mydevtime/design'

/**
 * Deterministic demo data for the Planner Monat/Jahr facets (design v6). No API
 * feeds these yet, so the screen labels them a preview (demo honesty, M7). The
 * ground law both views encode: **tasks** (planned work) carry a priority and
 * count toward day/month load; **events** (holiday, company event, info) never
 * count and never block — they are surfaced separately.
 */

/** A planned task in a month cell: priority, estimate (hours), label, project id. */
export interface MonthTask {
  readonly prio: Priority
  readonly estHours: number
  readonly label: string
  /** Project id → deterministic color (FNV-1a). */
  readonly project: string
}

/** A day in the month grid: its planned tasks and its (non-counting) events. */
export interface MonthDay {
  readonly tasks: readonly MonthTask[]
  readonly events: readonly string[]
}

const P = {
  finanzo: 'finanzo',
  sync: 'sync-engine',
  nordwind: 'nordwind',
  reviews: 'reviews',
} as const

/** July 2026 (1st = Wednesday). Keyed by day-of-month; absent days are empty. */
export const MONTH_DAYS: Readonly<Record<number, MonthDay>> = {
  1: { tasks: [t(2, 2, 'Finanzo API', P.finanzo), t(3, 1, 'PR-Reviews', P.reviews)], events: [] },
  2: {
    tasks: [t(1, 3, 'Sync: CRDT merge', P.sync), t(2, 1.5, 'Staging-Deploy', P.nordwind)],
    events: [],
  },
  3: { tasks: [t(2, 2, 'Audit-Log', P.finanzo)], events: ['Sommerfest (nachm.)'] },
  6: {
    tasks: [
      t(1, 2.5, 'SSO Entra ID', P.nordwind),
      t(2, 2, 'Finanzo Review', P.finanzo),
      t(3, 0.5, 'PR #412', P.reviews),
    ],
    events: [],
  },
  7: {
    tasks: [t(1, 3, 'Offline-Queue', P.sync), t(2, 1, 'Retry-Backoff', P.sync)],
    events: [],
  },
  8: {
    tasks: [
      t(2, 2, 'Rundungsfehler', P.finanzo),
      t(2, 1.5, 'Report-PDF', P.nordwind),
      t(3, 1, 'Changelog', P.sync),
    ],
    events: [],
  },
  9: { tasks: [t(1, 2, 'LCP mobil', P.reviews), t(3, 0.5, 'PR #77', P.reviews)], events: [] },
  10: { tasks: [t(2, 2, 'Mandanten-Import', P.finanzo)], events: [] },
  13: {
    tasks: [
      t(1, 2, 'Sync engine', P.sync),
      t(2, 1.5, 'Finanzo Review', P.finanzo),
      t(2, 0.75, 'Nordwind Call', P.nordwind),
      t(3, 0.75, 'Review backlog', P.reviews),
    ],
    events: [],
  },
  14: {
    tasks: [t(1, 3, 'Deep work: Sync', P.sync), t(2, 1, 'Pairing', P.sync)],
    events: ['Zahnarzt 16:30'],
  },
  15: {
    tasks: [
      t(1, 3, 'Finanzo API', P.finanzo),
      t(2, 1, 'Client call', P.nordwind),
      t(1, 2, 'Sync engine', P.sync),
    ],
    events: [],
  },
  16: {
    tasks: [t(2, 2.5, 'Nordwind Sprint', P.nordwind), t(3, 1, 'Dashboard-Widgets', P.nordwind)],
    events: [],
  },
  17: { tasks: [], events: ['Urlaub'] },
  20: {
    tasks: [t(2, 2, 'Hero-Section CMS', P.reviews), t(2, 1, 'Mega-Menu A11y', P.reviews)],
    events: [],
  },
  21: {
    tasks: [t(1, 3, 'SEPA-Export', P.finanzo), t(3, 0.75, 'Flaky test', P.finanzo)],
    events: [],
  },
  22: { tasks: [t(2, 2, 'Delta-Sync Telemetrie', P.sync)], events: ['Meetup Freiburg 19:00'] },
  23: {
    tasks: [t(2, 2.5, 'Onboarding-Checkliste', P.finanzo), t(3, 1, 'Cookie-Banner', P.reviews)],
    events: [],
  },
  24: { tasks: [t(3, 1.5, 'Bildpipeline AVIF', P.reviews)], events: [] },
  27: {
    tasks: [t(1, 2.5, 'Sync: Konflikt-UI', P.sync), t(2, 2, 'Audit-Log II', P.finanzo)],
    events: [],
  },
  28: { tasks: [t(2, 2, 'Nordwind Review', P.nordwind)], events: [] },
  29: {
    tasks: [t(1, 2, 'Release 1.4 vorbereiten', P.sync), t(2, 1, 'PR-Sweep', P.reviews)],
    events: ['Release-Day'],
  },
  30: { tasks: [t(3, 1, 'Docs-Pass', P.sync)], events: [] },
}

function t(prio: Priority, estHours: number, label: string, project: string): MonthTask {
  return { prio, estHours, label, project }
}

/** July 2026: 1st = Wednesday → Monday-start offset 2; 31 days; today = 13th. */
export const MONTH = { year: 2026, month0: 6, offset: 2, days: 31, today: 13, sollHours: 8.33 }

/** A month tile in the year facet: booked hours, 5 weekly load levels (0–3), event count. */
export interface YearMonth {
  readonly name: string
  readonly hours: number
  /** One intensity level 0–3 per week (5 weeks). */
  readonly weeks: readonly number[]
  readonly events: number
  readonly now?: boolean
}

export const YEAR_MONTHS: readonly YearMonth[] = [
  { name: 'Jan', hours: 152, weeks: [2, 2, 1, 2, 1], events: 1 },
  { name: 'Feb', hours: 148, weeks: [2, 1, 2, 2, 0], events: 0 },
  { name: 'Mär', hours: 166, weeks: [2, 3, 2, 2, 1], events: 1 },
  { name: 'Apr', hours: 141, weeks: [1, 2, 2, 1, 1], events: 2 },
  { name: 'Mai', hours: 155, weeks: [2, 2, 3, 2, 1], events: 2 },
  { name: 'Jun', hours: 172, weeks: [3, 3, 2, 3, 2], events: 0 },
  { name: 'Jul', hours: 76, weeks: [2, 3, 0, 0, 0], events: 3, now: true },
  { name: 'Aug', hours: 0, weeks: [1, 0, 0, 0, 0], events: 1 },
  { name: 'Sep', hours: 0, weeks: [1, 1, 0, 0, 0], events: 0 },
  { name: 'Okt', hours: 0, weeks: [0, 0, 0, 0, 0], events: 1 },
  { name: 'Nov', hours: 0, weeks: [0, 0, 0, 0, 0], events: 0 },
  { name: 'Dez', hours: 0, weeks: [0, 0, 0, 0, 0], events: 2 },
]
