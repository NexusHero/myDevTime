/**
 * Regional public-holiday calendars (REQ-029 follow-up, #150, ADR-0010): a pure,
 * deterministic holiday generator (ADR-0005) — no data files, no network. Fixed
 * holidays plus the Easter-derived movable feasts are computed from the year, so a
 * calendar is reproducible for any year. Holidays are excluded from the vacation
 * allowance draw (only `vacation`-kind absences draw it) and, once materialized as
 * absence days, are credited against the work-time target like any other absence.
 *
 * Coverage here is the Grenzgänger-relevant Baden-Württemberg ↔ Basel corridor
 * plus the national baselines; the set is intentionally extensible — add a region
 * to `REGION_RULES` with its fixed dates and Easter offsets. It is a scheduling
 * aid, not a legal certification; canton/Land edge cases can be layered on.
 */

/** A supported holiday region. `DE`/`CH` are the national baselines. */
export type HolidayRegion = 'DE' | 'DE-BW' | 'CH' | 'CH-BS' | 'CH-BL'

export const HOLIDAY_REGIONS: readonly HolidayRegion[] = ['DE', 'DE-BW', 'CH', 'CH-BS', 'CH-BL']

/** Easter Sunday for a Gregorian `year`, via the Anonymous Gregorian algorithm. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** A fixed `MM-DD` holiday in `year` as a `YYYY-MM-DD` string. */
function fixed(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** Easter Sunday plus `offset` days (may cross a month/year boundary), as ISO. */
function fromEaster(year: number, offset: number): string {
  const e = easterSunday(year)
  const ms = Date.UTC(year, e.month - 1, e.day) + offset * 86_400_000
  const dt = new Date(ms)
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Easter offsets, in days, for the movable feasts this module knows. */
const EASTER = {
  goodFriday: -2,
  easterMonday: 1,
  ascension: 39,
  whitMonday: 50,
  corpusChristi: 60,
} as const

interface RegionRule {
  /** Fixed `[month, day]` holidays. */
  readonly fixed: readonly (readonly [number, number])[]
  /** Easter-relative feasts, by name. */
  readonly easter: readonly (keyof typeof EASTER)[]
}

const DE_BASE: RegionRule = {
  fixed: [
    [1, 1], // Neujahr
    [5, 1], // Tag der Arbeit
    [10, 3], // Tag der Deutschen Einheit
    [12, 25], // 1. Weihnachtstag
    [12, 26], // 2. Weihnachtstag
  ],
  easter: ['goodFriday', 'easterMonday', 'ascension', 'whitMonday'],
}

const CH_BASE: RegionRule = {
  fixed: [
    [1, 1], // Neujahr
    [8, 1], // Bundesfeier (the one truly federal holiday)
    [12, 25], // Weihnachten
  ],
  easter: [],
}

function extend(base: RegionRule, extra: RegionRule): RegionRule {
  return { fixed: [...base.fixed, ...extra.fixed], easter: [...base.easter, ...extra.easter] }
}

const REGION_RULES: Record<HolidayRegion, RegionRule> = {
  DE: DE_BASE,
  'DE-BW': extend(DE_BASE, {
    fixed: [
      [1, 6], // Heilige Drei Könige
      [11, 1], // Allerheiligen
    ],
    easter: ['corpusChristi'],
  }),
  CH: CH_BASE,
  // Basel-Stadt / Basel-Landschaft observe the common Christian feasts on top of
  // the federal baseline (the Grenzgänger corridor with Baden-Württemberg).
  'CH-BS': extend(CH_BASE, {
    fixed: [
      [5, 1], // Tag der Arbeit
      [12, 26], // Stephanstag
    ],
    easter: ['goodFriday', 'easterMonday', 'ascension', 'whitMonday'],
  }),
  'CH-BL': extend(CH_BASE, {
    fixed: [
      [5, 1],
      [12, 26],
    ],
    easter: ['goodFriday', 'easterMonday', 'ascension', 'whitMonday'],
  }),
}

/**
 * The public holidays for `region` in `year`, as sorted, unique `YYYY-MM-DD`
 * strings. Deterministic: the same region + year always yields the same set.
 */
export function holidaysForRegion(region: HolidayRegion, year: number): string[] {
  const rule = REGION_RULES[region]
  const dates = new Set<string>()
  for (const [month, day] of rule.fixed) dates.add(fixed(year, month, day))
  for (const name of rule.easter) dates.add(fromEaster(year, EASTER[name]))
  return [...dates].sort()
}
