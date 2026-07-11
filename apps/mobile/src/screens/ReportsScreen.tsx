import { useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import {
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  projectColor,
  type Theme,
} from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import {
  AICallout,
  AIAskBar,
  Badge,
  BoxPlot,
  BudgetRing,
  Button,
  Card,
  CheckinCard,
  Heatmap,
  LoadMeter,
  Sparkline,
  StatTile,
  Tabs,
  WeekSparkline,
} from '../components/index'
import { useReports } from '../hooks/useReports'

/**
 * Reports — ported 1:1 from the design system's `ReportsScreen`: a Woche/Monat/Jahr
 * range switch, an AI ask-bar with scoped canned answers, the four-tile summary row,
 * the Balance card (LoadMeter + strain trend + deterministic signals + weekly
 * check-in + an AI recovery proposal), project distribution, a budget burn-down, the
 * live budget rings, and a range-specific daily-distribution card (Fokus /
 * Monatsübersicht / Intensität) beside the day-length BoxPlot.
 *
 * The trailing-week figures (Gearbeitet, Umsatz, Saldo, project distribution, budget
 * rings) stay driven by the live `useReports` resource (ADR-0005); Monat/Jahr and the
 * sections without a live source yet (strain signals, burn-down curve, month grid,
 * heatmap) use clearly-named `DEMO_*` constants. Every number renders through the pure
 * formatters in `@mydevtime/design`. AI output is always a proposal — it never mutates
 * state; it lands only on your tap.
 */
const H = 3_600_000
const M = 60_000

type Range = 'week' | 'month' | 'year'

interface DemoDist {
  readonly id: string
  readonly name: string
  readonly hours: number
}

interface RangeDemo {
  readonly label: string
  readonly workedMs: number
  readonly revenueMinor: number
  readonly overtimeMs: number
  readonly billableRatio: number
  readonly loadScore: number
  readonly dist: readonly DemoDist[]
  readonly burnValues: readonly number[]
  readonly burnWindow: string
  readonly tasksNeu: number
  readonly tasksZu: number
  readonly fazit: string
}

// Monat/Jahr have no live source yet — deterministic demo figures, formatted through
// the same pure formatters as the live week (ADR-0005).
const DEMO_RANGES: Readonly<Record<Range, RangeDemo>> = {
  week: {
    label: 'KW 28',
    workedMs: 41 * H + 15 * M,
    revenueMinor: 254_000,
    overtimeMs: 1 * H + 30 * M,
    billableRatio: 0.79,
    loadScore: 64,
    dist: [
      { id: 'finanzo', name: 'Finanzo AG', hours: 14.5 },
      { id: 'sync-engine', name: 'Sync engine', hours: 12.3 },
      { id: 'nordwind', name: 'Nordwind GmbH', hours: 8.2 },
      { id: 'atlas', name: 'Atlas Relaunch', hours: 6.3 },
    ],
    burnValues: [42, 46, 52, 56, 61, 66],
    burnWindow: 'Run-Rate dieser Woche (ø 1,6h/Tag)',
    tasksNeu: 5,
    tasksZu: 4,
    fazit: 'diese Woche fast im Gleichgewicht.',
  },
  month: {
    label: 'Juli 2026',
    workedMs: 168 * H + 20 * M,
    revenueMinor: 1_094_000,
    overtimeMs: 4 * H + 30 * M,
    billableRatio: 0.78,
    loadScore: 55,
    dist: [
      { id: 'finanzo', name: 'Finanzo AG', hours: 58 },
      { id: 'sync-engine', name: 'Sync engine', hours: 46 },
      { id: 'nordwind', name: 'Nordwind GmbH', hours: 38 },
      { id: 'atlas', name: 'Atlas Relaunch', hours: 26 },
    ],
    burnValues: [10, 16, 28, 34, 52, 66],
    burnWindow: 'Run-Rate der letzten 14 Tage (ø 1,9h/Tag)',
    tasksNeu: 14,
    tasksZu: 11,
    fazit: 'der Backlog wächst schneller als das Budget.',
  },
  year: {
    label: '2026',
    workedMs: 1642 * H,
    revenueMinor: 9_480_000,
    overtimeMs: 9 * H + 30 * M,
    billableRatio: 0.73,
    loadScore: 47,
    dist: [
      { id: 'finanzo', name: 'Finanzo AG', hours: 612 },
      { id: 'nordwind', name: 'Nordwind GmbH', hours: 388 },
      { id: 'sync-engine', name: 'Sync engine', hours: 296 },
      { id: 'atlas', name: 'Atlas Relaunch', hours: 214 },
      { id: 'intern', name: 'Intern & Sonstige', hours: 132 },
    ],
    burnValues: [4, 10, 20, 32, 50, 66],
    burnWindow: 'Verlauf seit Projektstart (Feb 2026)',
    tasksNeu: 34,
    tasksZu: 31,
    fazit: 'übers Jahr stabil — der Engpass ist das Stundenbudget, nicht der Backlog.',
  },
}

// Passive strain signals — a process seen over weeks, never a day's mood. No live
// balance model yet; deterministic demo (design-system reference).
const DEMO_SIGNALS: readonly {
  readonly tone: 'warn' | 'good'
  readonly label: string
  readonly detail: string
}[] = [
  { tone: 'warn', label: '3. Woche in Folge über Soll', detail: '+1:30h · +2:10h · +1:05h' },
  { tone: 'warn', label: '2× Pause übersprungen', detail: 'Di · Do' },
  {
    tone: 'warn',
    label: 'Erholungsfenster schrumpft',
    detail: 'ø 12:10h zwischen Feierabend & Start',
  },
  { tone: 'good', label: 'Keine Abend-Sessions', detail: 'letzte nach 20 Uhr: vor 9 Tagen' },
  { tone: 'good', label: 'Meeting-Anteil gesund', detail: '22% — unter deinem 30%-Limit' },
]

// 10-week passive-load trend (rising) — demo series for the strain sparkline.
const DEMO_LOAD_TREND: readonly number[] = [40, 38, 43, 41, 46, 44, 50, 54, 58, 63]

// 12-month intensity — deterministic demo cells for the year heatmap.
const DEMO_HEATMAP: readonly { readonly date: string; readonly value: number }[] = Array.from(
  { length: 84 },
  (_, i) => ({ date: `d${String(i)}`, value: (i * 7) % 11 }),
)

// Day-length distribution vs. 8:20h target — demo box-plot bounds (design reference).
const DEMO_BOXPLOT: Readonly<
  Record<Range, { min: number; q1: number; median: number; q3: number; max: number }>
> = {
  week: { min: 6.2, q1: 7.5, median: 8.4, q3: 9.2, max: 10.75 },
  month: { min: 6.2, q1: 7.5, median: 8.4, q3: 9.2, max: 10.75 },
  year: { min: 5.5, q1: 7.4, median: 8.3, q3: 9.0, max: 11.5 },
}

const DEMO_FOCUS_WEEK: readonly number[] = [6, 7.5, 8, 5, 7, 2, 0]

// Month grid: null = empty pad, -1 = booking gap (Buchungslücke), 'now' = today,
// number = booked hours bucket (0 = free/weekend). Drill-down demo.
const MONTH_GRID: readonly (number | 'now' | null)[] = [
  null,
  null,
  1,
  2,
  3,
  0,
  0,
  2,
  3,
  'now',
  -1,
  0,
  0,
  0,
  1,
  2,
  2,
  3,
  1,
  0,
  0,
  2,
  1,
  3,
  2,
  1,
  0,
  0,
  1,
  2,
  3,
  2,
  1,
  0,
  0,
]

interface AiScope {
  readonly label: string
  readonly question: string
  readonly answer: string
}

const AI_SCOPES: readonly AiScope[] = [
  {
    label: 'Projekte',
    question: 'Welches Projekt frisst mein Budget?',
    answer:
      'Nordwind: 91% des 80h-Budgets verbraucht, Run-Rate 1,9h/Tag — erschöpft etwa 21.7. Alle anderen Projekte liegen unter 65%.',
  },
  {
    label: 'Umsatz',
    question: 'Wie verteilt sich mein Umsatz?',
    answer:
      'Finanzo trägt den größten Anteil, gefolgt von Sync engine. Die Billable-Quote liegt bei rund 79% — der Rest ist interne Zeit ohne Verrechnung.',
  },
  {
    label: 'Saldo',
    question: 'Wie stehe ich beim Überstunden-Saldo?',
    answer:
      '+9:30h Jahressaldo. Dein Median-Tag liegt bei 8:24h, vier Minuten über Soll — der Saldo wächst also langsam weiter.',
  },
]

/** A colored uppercase section label (matches the reference micro-headings). */
function MicroLabel({ children }: { readonly children: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Text
      style={{
        fontSize: t.fontSize['2xs'],
        fontWeight: '700',
        letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
        textTransform: 'uppercase',
        color: t.color.ink3,
      }}
    >
      {children}
    </Text>
  )
}

/** A soft numeric status pill (warn/good) used as a card action. */
function NumPill({
  tone,
  children,
}: {
  readonly tone: 'warn' | 'good'
  readonly children: string
}): React.JSX.Element {
  const t = useTheme()
  const bg = tone === 'warn' ? t.color.warnSoft : t.color.goodSoft
  const fg = tone === 'warn' ? t.color.warn : t.color.good
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: t.radius.pill,
        backgroundColor: bg,
      }}
    >
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize['2xs'],
          fontWeight: '600',
          color: fg,
        }}
      >
        {children}
      </Text>
    </View>
  )
}

function overtimeLabel(ms: number): string {
  return `${ms >= 0 ? '+' : ''}${formatDuration(ms)} h`
}

interface DistItem {
  readonly id: string
  readonly name: string
  readonly ms: number
}

/** Project distribution: colored share bar + legend (the reference donut, flattened). */
function Distribution({ items }: { readonly items: readonly DistItem[] }): React.JSX.Element {
  const t = useTheme()
  const total = items.reduce((s, p) => s + p.ms, 0)
  return (
    <View style={{ gap: t.spacing.s3 }}>
      {/* TODO(design): a true donut needs an arc component; a stacked share bar
          carries the same distribution with the primitives available. */}
      <View
        style={{
          flexDirection: 'row',
          height: 12,
          borderRadius: t.radius.pill,
          overflow: 'hidden',
          gap: 2,
          backgroundColor: t.color.sunk,
        }}
      >
        {items.map(p => (
          <View
            key={p.id}
            style={{
              flexGrow: total > 0 ? p.ms : 1,
              flexBasis: 0,
              backgroundColor: projectColor(p.id, t.mode),
            }}
          />
        ))}
      </View>
      <View style={{ gap: t.spacing.s2 }}>
        {items.map(p => (
          <View
            key={p.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                backgroundColor: projectColor(p.id, t.mode),
              }}
            />
            <Text
              style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink, fontWeight: '600' }}
              numberOfLines={1}
            >
              {p.name}
            </Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize['2xs'],
                color: t.color.ink2,
              }}
            >
              {formatDuration(p.ms)} h
            </Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize['2xs'],
                color: t.color.ink3,
                width: 40,
                textAlign: 'right',
              }}
            >
              {formatPercent(total > 0 ? p.ms / total : 0)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function projectColorForRow(id: string, mode: Theme['mode']): string {
  return projectColor(id, mode)
}

export function ReportsScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const reports = useReports()

  const [range, setRange] = useState<Range>('week')
  const [checkedIn, setCheckedIn] = useState(false)
  const [aiValue, setAiValue] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [selDay, setSelDay] = useState(9)

  const demo = DEMO_RANGES[range]

  // Live-week figures where the resource has them; DEMO for Monat/Jahr and the
  // fields with no live source (billable %, load score).
  const isWeek = range === 'week'
  const trackedMs = isWeek ? (reports.data?.totalMs ?? demo.workedMs) : demo.workedMs
  const revenueMinor = isWeek
    ? (reports.data?.billableMinor ?? demo.revenueMinor)
    : demo.revenueMinor
  const currencyCode = reports.data?.currencyCode ?? 'EUR'
  const overtimeMs = isWeek ? (reports.data?.overtimeMs ?? demo.overtimeMs) : demo.overtimeMs
  const budgets = reports.data?.budgets ?? []
  const liveByProject = reports.data?.byProject ?? []

  // Distribution source: live projects for the week, DEMO hours for Monat/Jahr.
  const distItems: readonly DistItem[] =
    isWeek && liveByProject.length > 0
      ? liveByProject.map(p => ({ id: p.id, name: p.name, ms: p.spentMs }))
      : demo.dist.map(p => ({ id: p.id, name: p.name, ms: p.hours * H }))

  const overtimeTone: 'warn' | 'good' = overtimeMs > 0 ? 'warn' : 'good'

  const askScope = (scope: AiScope): void => {
    setAiValue(scope.question)
    setAiAnswer(scope.answer)
  }
  const submitAsk = (): void => {
    const hit = AI_SCOPES.find(s => s.question === aiValue.trim())
    setAiAnswer(
      hit?.answer ??
        'Dazu habe ich gerade keine Auswertung — frag mich nach Projekten, Umsatz oder Saldo.',
    )
  }

  const rangeError =
    reports.error !== null && isWeek && reports.data === null ? reports.error : null

  // Honest labelling (M7): cards with no live source yet carry a "Vorschau" badge so
  // demo figures never masquerade as the user's real data. The week summary/billable/
  // budget cards are live; the strain, heatmap, box-plot and Monat/Jahr tiles are not.
  const previewBadge = <Badge tone="neutral">Vorschau</Badge>

  const balanceCard = (
    <Card
      title="Balance"
      subtitle={`${demo.label} · Belastung aus deinen eigenen Daten — keine Diagnose`}
      action={previewBadge}
    >
      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: t.spacing.s5,
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{ alignSelf: 'stretch', gap: t.spacing.s4, ...(stacked ? null : { flex: 1 }) }}
        >
          <LoadMeter label="Belastung" value={demo.loadScore} />
          <View style={{ gap: t.spacing.s2 }}>
            <MicroLabel>Verlauf · 10 Wochen</MicroLabel>
            <Sparkline
              values={DEMO_LOAD_TREND}
              color={t.color.warn}
              width={stacked ? 260 : 300}
              height={48}
              label="Belastungsverlauf 10 Wochen"
            />
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
              Linie = passive Signale · deine Check-ins fließen ein
            </Text>
          </View>
        </View>
        <View
          style={{ alignSelf: 'stretch', gap: t.spacing.s2, ...(stacked ? null : { flex: 1 }) }}
        >
          {DEMO_SIGNALS.map(s => (
            <View
              key={s.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: s.tone === 'warn' ? t.color.warn : t.color.good,
                }}
              />
              <Text
                style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink, fontWeight: '600' }}
                numberOfLines={1}
              >
                {s.label}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink3,
                }}
              >
                {s.detail}
              </Text>
            </View>
          ))}
          <View
            style={{
              marginTop: t.spacing.s2,
              paddingTop: t.spacing.s3,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              gap: t.spacing.s2,
            }}
          >
            <MicroLabel>Wochen-Check-in</MicroLabel>
            <CheckinCard
              label={checkedIn ? 'Check-in erfasst — danke' : 'Wie fühlst du dich diese Woche?'}
              checked={checkedIn}
              onPress={() => setCheckedIn(true)}
            />
          </View>
        </View>
      </View>
      <View style={{ marginTop: t.spacing.s3 }}>
        <AICallout
          title={
            checkedIn
              ? 'Dein Check-in bestätigt die Daten.'
              : 'Deine Belastung steigt seit drei Wochen.'
          }
          action={
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              <Button size="sm">✦ In Planner übernehmen</Button>
              <Button size="sm" variant="ghost">
                Später
              </Button>
            </View>
          }
        >
          {checkedIn
            ? 'Du meldest Erschöpfung 4/5 — und die passiven Signale zeigen die dritte Woche über Soll, das passt zusammen. Vorschlag: Donnerstag meetingfrei, Feierabend-Ghost 17:30, Reviews auf Freitagvormittag.'
            : 'Vorschlag für nächste Woche: Donnerstag meetingfrei halten, Feierabend-Ghost um 17:30 setzen und die zwei Review-Blöcke auf Freitagvormittag ziehen — das bringt dich rechnerisch zurück auf Soll.'}
        </AICallout>
      </View>
    </Card>
  )

  const distributionCard = (
    <Card
      title="Wohin ging die Zeit?"
      subtitle={`${demo.label} · nach Projekt`}
      action={isWeek ? undefined : previewBadge}
      style={{ flex: 1 }}
    >
      {isWeek && reports.loading && reports.data === null ? (
        <Text style={{ color: t.color.ink2 }}>Wird geladen …</Text>
      ) : rangeError !== null ? (
        <Text style={{ color: t.color.crit }}>
          Reports konnten nicht geladen werden — {rangeError.message}
        </Text>
      ) : distItems.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>Noch keine Zeit in diesem Zeitraum erfasst.</Text>
      ) : (
        <Distribution items={distItems} />
      )}
    </Card>
  )

  const burnCard = (
    <Card
      title="Budget burn-down"
      subtitle="Nordwind GmbH · 80h fixed"
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          {previewBadge}
          <NumPill tone="warn">erschöpft ~21.7.</NumPill>
        </View>
      }
      style={{ flex: 1 }}
    >
      <Sparkline
        values={demo.burnValues}
        color={projectColorForRow('nordwind', t.mode)}
        width={stacked ? 260 : 300}
        height={64}
        label="Budget burn-down"
      />
      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: t.spacing.s2 }}>
        {demo.burnWindow} — Fenster und Rate sichtbar, keine falsche Präzision.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          marginTop: t.spacing.s3,
          paddingTop: t.spacing.s3,
          borderTopWidth: 1,
          borderTopColor: t.color.border,
        }}
      >
        <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.color.accent }} />
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.xs,
            fontWeight: '700',
            color: t.color.ink,
          }}
        >
          {demo.tasksNeu}
        </Text>
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>neu</Text>
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            backgroundColor: t.color.good,
            marginLeft: t.spacing.s2,
          }}
        />
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize.xs,
            fontWeight: '700',
            color: t.color.ink,
          }}
        >
          {demo.tasksZu}
        </Text>
        <Text style={{ flex: 1, fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
          geschlossen — {demo.fazit}
        </Text>
      </View>
    </Card>
  )

  const budgetsCard = (
    <Card title="Budgets" subtitle={`${demo.label} · Verbrauch nach Projekt`}>
      {budgets.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>Noch keine Projektbudgets gesetzt.</Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.spacing.s5,
            justifyContent: 'space-around',
          }}
        >
          {budgets.map(b => (
            <View key={b.id} style={{ alignItems: 'center', gap: t.spacing.s2, width: 96 }}>
              <BudgetRing ratio={b.ratio} label={b.name} />
              <Text
                style={{ fontSize: t.fontSize.sm, color: t.color.ink, fontWeight: '600' }}
                numberOfLines={1}
              >
                {b.name}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  color: t.color.ink2,
                }}
              >
                {b.basis === 'money'
                  ? formatMoneyMinor(b.consumed, b.currencyCode)
                  : `${formatDuration(b.consumed)} h`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  )

  const boxPlotCard = (
    <Card
      title="Tagesarbeitszeit"
      subtitle={`${demo.label} · Verteilung vs. Soll 8:20h`}
      action={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          {previewBadge}
          <NumPill tone={overtimeTone}>{`Saldo ${overtimeLabel(overtimeMs)}`}</NumPill>
        </View>
      }
      style={{ flex: 1 }}
    >
      <BoxPlot label="Stunden pro Tag" {...DEMO_BOXPLOT[range]} />
      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: t.spacing.s2 }}>
        Die Box ist dein typischer Tag (25–75%), der Strich der Median — liegt die Box rechts vom
        Soll, baust du Überstunden auf.
      </Text>
    </Card>
  )

  const focusCard = (
    <Card
      title="Fokus-Stunden"
      subtitle="Täglich, diese Woche"
      action={previewBadge}
      style={{ flex: 1 }}
    >
      <WeekSparkline label="Fokus pro Tag" data={DEMO_FOCUS_WEEK} />
    </Card>
  )

  const heatmapCard = (
    <Card title="Intensität" subtitle="Letzte 12 Monate" action={previewBadge} style={{ flex: 1 }}>
      <Heatmap label="Aktivität pro Woche" data={DEMO_HEATMAP} />
    </Card>
  )

  const monthCard = (() => {
    const v = MONTH_GRID[selDay] ?? null
    const dayNum = selDay - 1
    const head = `${String(dayNum)}. Juli`
    let drill: React.JSX.Element
    if (v === -1) {
      drill = (
        <View
          style={{
            marginTop: t.spacing.s3,
            padding: t.spacing.s3,
            borderRadius: t.radius.block,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.color.warn,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
          }}
        >
          <Text style={{ flex: 1, fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
            <Text style={{ color: t.color.ink, fontWeight: '700' }}>{head}</Text>
            {' — Buchungslücke: Arbeitstag ohne Buchung.'}
          </Text>
          <Button size="sm" variant="secondary">
            Nachtragen
          </Button>
        </View>
      )
    } else if (v === 0 || v === null) {
      drill = (
        <Text style={{ marginTop: t.spacing.s3, fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          <Text style={{ color: t.color.ink2, fontWeight: '700' }}>{head}</Text>
          {' — keine Buchungen (Wochenende/frei).'}
        </Text>
      )
    } else {
      const entries: readonly (readonly [string, string, string])[] =
        v === 'now'
          ? [
              ['Finanzo Review', 'finanzo', '1:30'],
              ['Nordwind Call', 'nordwind', '0:45'],
              ['Sync engine', 'sync-engine', '2:10'],
            ]
          : [
              ['Finanzo API', 'finanzo', `${String(v)}:10`],
              ['Sync engine', 'sync-engine', v === 1 ? '0:50' : `${String(v - 1)}:40`],
            ]
      drill = (
        <View style={{ marginTop: t.spacing.s3, gap: t.spacing.s2 }}>
          <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '700', color: t.color.ink }}>
            {head}
            {v === 'now' ? ' · heute' : ''}
          </Text>
          {entries.map(([n, id, h]) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3,
                  backgroundColor: projectColorForRow(id, t.mode),
                }}
              />
              <Text
                style={{ flex: 1, fontSize: t.fontSize['2xs'], color: t.color.ink2 }}
                numberOfLines={1}
              >
                {n}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink2,
                }}
              >
                {h}h
              </Text>
            </View>
          ))}
        </View>
      )
    }

    return (
      <Card
        title="Monatsübersicht"
        subtitle="Juli 2026 · Tag antippen für Einträge"
        action={previewBadge}
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 266 }}>
          {MONTH_GRID.map((cell, i) => {
            const bg = cell === null ? 'transparent' : cell === 'now' ? t.color.live : t.color.sunk
            const borderColor =
              cell === -1 ? t.color.warn : selDay === i ? t.color.accent : 'transparent'
            const dot = typeof cell === 'number' && cell > 0 ? 4 + cell * 1.5 : 0
            return (
              <Pressable
                key={i}
                disabled={cell === null}
                onPress={() => setSelDay(i)}
                accessibilityRole="button"
                accessibilityLabel={`Tag ${String(i - 1)}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                  borderWidth: cell === -1 ? 1.5 : 2,
                  borderStyle: cell === -1 ? 'dashed' : 'solid',
                  borderColor,
                }}
              >
                {dot > 0 && (
                  <View
                    style={{
                      width: dot,
                      height: dot,
                      borderRadius: dot / 2,
                      backgroundColor: t.color.accent,
                    }}
                  />
                )}
              </Pressable>
            )
          })}
        </View>
        {drill}
      </Card>
    )
  })()

  const bottomSecondCard =
    range === 'week' ? focusCard : range === 'month' ? monthCard : heatmapCard

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}
    >
      {/* Title + export */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.spacing.s3 }}
      >
        <Text
          style={{
            flex: 1,
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
            letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
          }}
        >
          Reports
        </Text>
        {!reports.live && <Badge tone="neutral">Demo-Daten</Badge>}
        <Button size="sm" variant="ghost">
          {`${range === 'year' ? 'Jahresbericht' : 'Monatsbericht'} exportieren`}
        </Button>
      </View>

      <Tabs
        items={[
          { value: 'week', label: 'Woche' },
          { value: 'month', label: 'Monat' },
          { value: 'year', label: 'Jahr' },
        ]}
        active={range}
        onChange={value => setRange(value as Range)}
      />

      {/* AI in context — scoped, with pre-written answers (proposals, never mutation) */}
      <View style={{ gap: t.spacing.s2, maxWidth: 680 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          {AI_SCOPES.map(s => (
            <Pressable
              key={s.label}
              onPress={() => askScope(s)}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color.surface,
              }}
            >
              <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '600', color: t.color.ink2 }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <AIAskBar
          value={aiValue}
          onChange={setAiValue}
          onSubmit={submitAsk}
          placeholder="Frag deine Reports — Projekte, Umsatz, Saldo"
        />
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          Vorschau: Beispiel-Antworten auf die Chips oben — der Assistent auf deinen echten Daten
          wird angebunden.
        </Text>
        {aiAnswer !== null && <AICallout title="✦ Antwort">{aiAnswer}</AICallout>}
      </View>

      {/* Summary row: how much · paid share · earned · balance */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
        {[
          {
            key: 'worked',
            label: `Gearbeitet · ${demo.label}`,
            value: `${formatDuration(trackedMs)} h`,
          },
          { key: 'billable', label: 'Billable-Quote', value: formatPercent(demo.billableRatio) },
          { key: 'revenue', label: 'Umsatz', value: formatMoneyMinor(revenueMinor, currencyCode) },
          { key: 'saldo', label: 'Saldo', value: overtimeLabel(overtimeMs) },
        ].map(tile => (
          <View
            key={tile.key}
            style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}
          >
            <StatTile label={tile.label} value={tile.value} />
          </View>
        ))}
      </View>

      {balanceCard}

      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: t.spacing.s3,
          alignItems: 'flex-start',
        }}
      >
        {distributionCard}
        {burnCard}
      </View>

      {budgetsCard}

      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: t.spacing.s3,
          alignItems: 'flex-start',
        }}
      >
        {boxPlotCard}
        {bottomSecondCard}
      </View>
    </ScrollView>
  )
}
