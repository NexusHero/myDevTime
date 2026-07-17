import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { formatDuration, formatMoneyMinor, formatPercent, projectColor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import {
  BoxPlot,
  BudgetRing,
  Button,
  Card,
  CheckinCard,
  EmptyState,
  Heatmap,
  InsightCard,
  LoadMeter,
  ScreenScaffold,
  Sparkline,
  StatTile,
  Tabs,
} from '../components/index'
import { effectiveRate, priceWeek, weekLoadFromMinutes } from '@mydevtime/domain'
import { useVisibility } from '../roles/RoleContext'
import { weeklyBalance } from '../reports/balanceRow'
import { useReports } from '../hooks/useReports'
import { useRevenueBudget } from '../hooks/useRevenueBudget'
import { useOvertimeTrend } from '../hooks/useOvertimeTrend'
import { useBalance } from '../hooks/useBalance'
import { useCheckin } from '../hooks/useCheckin'
import { useTrackingHeatmap } from '../hooks/useTrackingHeatmap'
import { useBudgetBurndown } from '../hooks/useBudgetBurndown'
import { rangeLabel, type ReportRange } from '../reports/window'
import type { ClientRevenueRow } from '../reports/revenueBudget'
import type { AgingKey, OpenAging } from '../api/invoicing'

/**
 * Reports (REQ-005/009/032, ux-vision §3) — three views. Overview + Revenue & Budget
 * show the selected window (Week/Month/Year) from the live `useReports`/`useRevenueBudget`
 * resources (ADR-0005): Worked, Revenue, Overtime balance, the per-project distribution,
 * the budget rings, revenue-by-client and aging, plus the 12-week tracking heatmap and the
 * most-committed budget's burn-down (`useTrackingHeatmap`/`useBudgetBurndown`). Balance
 * (design v10) shows the trailing ten weeks from `useBalance` — the neutral workload meter,
 * the focus trend and the day-length spread — plus the local-only weekly check-in
 * (`useCheckin`, ADR-0060). There is no fabricated data: with no tracked time every card
 * shows its honest empty state. Every figure renders through the pure formatters in
 * `@mydevtime/design`.
 */
type Range = ReportRange

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

function overtimeLabel(ms: number): string {
  return `${ms >= 0 ? '+' : ''}${formatDuration(ms)} h`
}

const AGING_LABEL: Record<AgingKey, string> = {
  recent: '≤ 30 days',
  mid: '31–60 days',
  old: '> 60 days',
}

/** Revenue-by-client rows (D13): client, its effective rate, billable-share bar, hours,
 *  revenue. The "model" line shows the real derived €/h (or "non-billable") — the data
 *  model has no Retainer/Fixed/T&M taxonomy, so nothing is fabricated. */
function ClientRevenueList({
  rows,
  currencyCode,
}: {
  readonly rows: readonly ClientRevenueRow[]
  readonly currencyCode: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s3 }}>
      {rows.map(cl => {
        const rateLabel =
          cl.effectiveRateMinorPerHour === null
            ? 'non-billable'
            : `≈ ${formatMoneyMinor(cl.effectiveRateMinorPerHour, currencyCode)}/h`
        const barColor = cl.billablePct === 0 ? t.color.border : projectColor(cl.clientId, t.mode)
        return (
          <View
            key={cl.clientId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              flexWrap: 'wrap',
            }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                backgroundColor: projectColor(cl.clientId, t.mode),
              }}
            />
            <View style={{ flexGrow: 1, flexBasis: 140, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink }}
              >
                {cl.name}
              </Text>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>{rateLabel}</Text>
            </View>
            <View
              style={{
                flexGrow: 2,
                flexBasis: 120,
                minWidth: 100,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.s2,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: t.color.sunk,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${cl.billablePct}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: barColor,
                  }}
                />
              </View>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  color: t.color.ink3,
                  width: 62,
                }}
              >
                {cl.billablePct}% billable
              </Text>
            </View>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.xs,
                color: t.color.ink2,
                width: 52,
                textAlign: 'right',
              }}
            >
              {formatDuration(cl.spentMs)} h
            </Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.xs,
                fontWeight: '700',
                color: t.color.ink,
                width: 72,
                textAlign: 'right',
              }}
            >
              {formatMoneyMinor(cl.revenueMinor, currencyCode)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** Unbilled open work split by age (D13): a stacked bar + legend, escalating colour by
 *  age. Older debt is hardest to collect, so it is flagged. */
function AgingCard({ aging }: { readonly aging: OpenAging }): React.JSX.Element {
  const t = useTheme()
  const color = (key: AgingKey): string =>
    key === 'recent' ? t.color.good : key === 'mid' ? t.color.warn : t.color.crit
  const old = aging.buckets.find(b => b.key === 'old')?.minor ?? 0
  return (
    <Card
      title="Unbilled"
      subtitle={`Open work by age · total ${formatMoneyMinor(aging.totalMinor, aging.currencyCode)}`}
    >
      {aging.totalMinor === 0 ? (
        <Text style={{ color: t.color.ink2 }}>Nothing open — all billable work is invoiced.</Text>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              backgroundColor: t.color.sunk,
            }}
          >
            {aging.buckets.map(b => (
              <View
                key={b.key}
                style={{ flexGrow: b.minor, flexBasis: 0, backgroundColor: color(b.key) }}
              />
            ))}
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: t.spacing.s4,
              marginTop: t.spacing.s3,
            }}
          >
            {aging.buckets.map(b => (
              <View
                key={b.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color(b.key) }}
                />
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                  {AGING_LABEL[b.key]}:
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    fontWeight: '700',
                    color: b.key === 'old' ? t.color.warn : t.color.ink,
                  }}
                >
                  {formatMoneyMinor(b.minor, aging.currencyCode)}
                </Text>
              </View>
            ))}
          </View>
          {old > 0 && (
            <Text
              style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: t.spacing.s2 }}
            >
              Bill items older than 60 days first — they are hardest to collect.
            </Text>
          )}
          <Text
            style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: t.spacing.s2 }}
          >
            Create invoices from Projects → pick a client → Invoice.
          </Text>
        </>
      )}
    </Card>
  )
}

export function ReportsScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const [range, setRange] = useState<Range>('week')
  const [view, setView] = useState<'overview' | 'money' | 'balance'>('overview')
  // Role visibility (design v14 §R): a Stempler (Employed) never sees €/clients/billing, so
  // the Revenue & Budget view is hidden for them; Overview and Balance stay for every role.
  const showMoney = useVisibility().isVisible('invoicing')
  const reports = useReports(range)
  const rb = useRevenueBudget(range)
  const balance = useBalance()
  const checkin = useCheckin()
  const heatmap = useTrackingHeatmap()
  const label = rangeLabel(range)
  // The burn-down follows the most-committed budget — the one closest to exhausting.
  const topBudget =
    [...(reports.data?.budgets ?? [])]
      .filter(b => b.ratio > 0)
      .sort((a, b) => b.ratio - a.ratio)[0] ?? null
  const burndown = useBudgetBurndown(topBudget?.id ?? null)

  const otrend = useOvertimeTrend()
  const data = reports.data
  const trackedMs = data?.totalMs ?? 0
  const revenueMinor = data?.billableMinor ?? 0
  const currencyCode = data?.currencyCode ?? 'EUR'
  const overtimeMs = data?.overtimeMs ?? 0
  // Effective-rate truth (G2): revenue ÷ ALL tracked hours vs the nominal ÷ billable hours.
  const eff = effectiveRate(revenueMinor, Math.min(data?.billableMs ?? 0, trackedMs), trackedMs)
  const budgets = data?.budgets ?? []
  const distItems: readonly DistItem[] = (data?.byProject ?? []).map(p => ({
    id: p.id,
    name: p.name,
    ms: p.spentMs,
  }))

  const loading = reports.loading && data === null
  const error = reports.error !== null && data === null ? reports.error : null

  const summaryTiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
      {[
        { key: 'worked', label: `Worked · ${label}`, value: `${formatDuration(trackedMs)} h` },
        { key: 'revenue', label: 'Revenue', value: formatMoneyMinor(revenueMinor, currencyCode) },
        { key: 'saldo', label: 'Overtime balance', value: overtimeLabel(overtimeMs) },
      ].map(tile => (
        <View key={tile.key} style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
          <StatTile label={tile.label} value={tile.value} />
        </View>
      ))}
    </View>
  )

  const distributionCard = (
    <Card title="Where did the time go?" subtitle={`${label} · by project`} style={{ flex: 1 }}>
      {loading ? (
        <Text style={{ color: t.color.ink2 }}>Loading…</Text>
      ) : error !== null ? (
        <Text style={{ color: t.color.crit }}>Reports could not be loaded — {error.message}</Text>
      ) : distItems.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>No time tracked in this period.</Text>
      ) : (
        <Distribution items={distItems} />
      )}
    </Card>
  )

  const budgetsCard = (
    <Card title="Budgets" subtitle="Usage by project">
      {loading ? (
        <Text style={{ color: t.color.ink2 }}>Loading…</Text>
      ) : budgets.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>No project budgets set yet.</Text>
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

  // Revenue & Budget (D13): revenue per client, avg effective rate, unbilled aging —
  // all from the live `useRevenueBudget` resource (deterministic core), week only.
  const rbData = rb.data
  const rbLoading = rb.loading && rbData === null
  const rbError = rb.error !== null && rbData === null ? rb.error : null
  const rbCurrency = rbData?.currencyCode ?? 'EUR'
  const rate =
    rbData?.effectiveRateMinorPerHour == null
      ? '—'
      : `${formatMoneyMinor(rbData.effectiveRateMinorPerHour, rbCurrency)}/h`
  const clients = rbData?.clients ?? []

  const moneyView = (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
        {[
          {
            key: 'rev',
            label: `Revenue · ${label}`,
            value: formatMoneyMinor(rbData?.revenueMinor ?? 0, rbCurrency),
          },
          {
            key: 'open',
            label: 'Unbilled',
            value: formatMoneyMinor(rbData?.openMinor ?? 0, rbCurrency),
          },
          { key: 'rate', label: 'Avg effective rate', value: rate },
          { key: 'bill', label: 'Billable share', value: `${String(rbData?.billablePct ?? 0)}%` },
        ].map(tile => (
          <View
            key={tile.key}
            style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}
          >
            <StatTile label={tile.label} value={tile.value} />
          </View>
        ))}
      </View>
      {/* Effective-rate truth (G2): what an hour is really worth once unbilled time counts. */}
      <Card title="What an hour is really worth" subtitle={`${label} · nominal vs effective`}>
        {trackedMs === 0 ? (
          <Text style={{ color: t.color.ink2 }}>No tracked time in this period.</Text>
        ) : (
          <View style={{ gap: t.spacing.s3 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
              <View style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
                <StatTile
                  label="Nominal (billed hours)"
                  value={
                    eff.nominalPerHourMinor === null
                      ? '—'
                      : `${formatMoneyMinor(eff.nominalPerHourMinor, currencyCode)}/h`
                  }
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
                <StatTile
                  label="Effective (all hours)"
                  value={
                    eff.effectivePerHourMinor === null
                      ? '—'
                      : `${formatMoneyMinor(eff.effectivePerHourMinor, currencyCode)}/h`
                  }
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
                <StatTile
                  label="Utilization"
                  value={`${String(Math.round(eff.utilization * 100))}%`}
                />
              </View>
            </View>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              The effective rate divides the same revenue across every tracked hour — billable work,
              admin and meetings — so it&apos;s the honest number.
            </Text>
          </View>
        )}
      </Card>
      <Card title="Revenue by client" subtitle={`${label} · hours, billable share, revenue`}>
        {rbLoading ? (
          <Text style={{ color: t.color.ink2 }}>Loading…</Text>
        ) : rbError !== null ? (
          <Text style={{ color: t.color.crit }}>
            Reports could not be loaded — {rbError.message}
          </Text>
        ) : clients.length === 0 ? (
          <Text style={{ color: t.color.ink2 }}>No billable revenue in this period.</Text>
        ) : (
          <ClientRevenueList rows={clients} currencyCode={rbCurrency} />
        )}
      </Card>
      {rbData?.aging ? <AgingCard aging={rbData.aging} /> : null}
    </>
  )

  // Tracking heatmap (REQ-005): twelve weeks of real daily tracked minutes. Renders the
  // deterministic `dailyMinutesSeries`; an all-zero grid is honest, not a placeholder.
  const heatCells = heatmap.data ?? []
  const heatMax = heatCells.reduce((m, c) => Math.max(m, c.value), 0)
  const heatmapCard = (
    <Card title="Consistency" subtitle="Tracked time · last 12 weeks">
      {heatmap.loading && heatmap.data === null ? (
        <Text style={{ color: t.color.ink2 }}>Loading…</Text>
      ) : heatMax === 0 ? (
        <EmptyState
          title="No tracked time yet"
          hint="Track a few days and the last twelve weeks light up here — darker means more tracked that day."
          compact
        />
      ) : (
        <>
          <Heatmap label="Minutes tracked per day" data={heatCells} max={heatMax} />
          <Text
            style={{ marginTop: t.spacing.s2, fontSize: t.fontSize['2xs'], color: t.color.ink3 }}
          >
            Darker = more tracked that day · peak {formatDuration(heatMax * 60_000)} h.
          </Text>
        </>
      )}
    </Card>
  )

  // Budget burn-down (REQ-005, design v10): the most-committed budget's cumulative
  // consumption curve + a deterministic exhaustion projection (`burndownProjection`).
  const DAY_MS = 86_400_000
  const MONTHS_ABBR = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const monthDay = (ms: number): string => {
    const dt = new Date(ms)
    return `${MONTHS_ABBR[dt.getUTCMonth()] ?? ''} ${String(dt.getUTCDate())}`
  }
  const burnData = burndown.data
  const fmtBudget = (v: number): string =>
    burnData && burnData.budget.basis === 'money'
      ? formatMoneyMinor(v, burnData.currencyCode)
      : `${formatDuration(v)} h`
  const bdPoints = burnData?.points ?? []
  const bdLast = bdPoints[bdPoints.length - 1]?.consumed ?? 0
  const bdLimit = burnData?.budget.limitAmount ?? 0
  const bdPct = bdLimit > 0 ? Math.round((bdLast / bdLimit) * 100) : 0
  const proj = burndown.projection
  const projText = !proj
    ? ''
    : proj.over
      ? 'Over budget — every further hour is unbudgeted.'
      : proj.exhaustsAt !== null
        ? `At ${fmtBudget(proj.ratePerMs * DAY_MS)}/day, projected to run out around ${monthDay(proj.exhaustsAt)}.`
        : 'On track — no exhaustion at the current pace.'
  const burndownCard = (
    <Card
      title="Budget burn-down"
      subtitle={
        topBudget ? `${topBudget.name} · ${fmtBudget(bdLimit)} budget` : 'Most-committed budget'
      }
    >
      {topBudget === null ? (
        <EmptyState
          title="No budget to track yet"
          hint="Set a project budget (Projects → a project → Budget) and its burn-down appears here."
          compact
        />
      ) : burndown.loading && burnData === null ? (
        <Text style={{ color: t.color.ink2 }}>Loading…</Text>
      ) : bdPoints.length < 2 ? (
        <EmptyState
          title="Not enough history yet"
          hint="A little more tracked time and the consumption curve appears here."
          compact
        />
      ) : (
        <View style={{ gap: t.spacing.s3 }}>
          <Sparkline
            values={bdPoints.map(p => p.consumed)}
            width={300}
            height={48}
            color={proj?.over ? t.color.crit : t.color.accent}
          />
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xs,
              color: t.color.ink,
            }}
          >
            {`${fmtBudget(bdLast)} of ${fmtBudget(bdLimit)} used · ${String(bdPct)}%`}
          </Text>
          <Text
            style={{ fontSize: t.fontSize['2xs'], color: proj?.over ? t.color.crit : t.color.ink3 }}
          >
            {projText}
          </Text>
        </View>
      )}
    </Card>
  )

  // Price of the week (G1): what a week like this costs across intensities — a what-if from
  // this week's tracked total against a standard 8h/5-day frame (rule-based, ADR-0005).
  const weekMin = Math.round(trackedMs / 60_000)
  const weekPrices =
    weekMin > 0
      ? priceWeek(
          weekLoadFromMinutes({
            totalWorkMin: weekMin,
            availableDays: 5,
            targetDailyMin: 480,
            billableWorkMin: Math.round(Math.min(data?.billableMs ?? 0, trackedMs) / 60_000),
            ratePerHourMinor: eff.effectivePerHourMinor ?? 0,
          }),
        )
      : []
  const priceCard = (
    <Card title="Price of the week" subtitle="What a week like this costs · assuming 8h × 5 days">
      {weekPrices.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>No tracked time this week yet.</Text>
      ) : (
        <View style={{ gap: t.spacing.s2 }}>
          {weekPrices.map(p => (
            <View
              key={p.intensity}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
            >
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  color: t.color.ink,
                  fontWeight: '600',
                  width: 96,
                  textTransform: 'capitalize',
                }}
              >
                {p.intensity}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  color: t.color.ink2,
                  flex: 1,
                }}
              >
                {`${String(p.activeDays)}d · ${formatDuration(p.perDayMs)}/day · ${p.freeDays > 0 ? `${String(p.freeDays)} free` : 'no free day'}`}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  color: p.overtimeMs > 0 ? t.color.warn : t.color.ink3,
                }}
              >
                {p.overtimeMs > 0 ? `+${formatDuration(p.overtimeMs)} OT` : 'on target'}
              </Text>
            </View>
          ))}
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            Sustainable spreads across more, lighter days; dense buys free days with longer ones.
          </Text>
        </View>
      )}
    </Card>
  )

  const overviewView = (
    <>
      {summaryTiles}
      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: t.spacing.s3,
          alignItems: 'flex-start',
        }}
      >
        {distributionCard}
        {budgetsCard}
      </View>
      {priceCard}
      {heatmapCard}
      {burndownCard}
    </>
  )

  // Balance (design v10 §Balance, REQ-032): strain made visible from the user's OWN
  // tracked time — never a diagnosis. The passive signals (workload vs target, the
  // 10-week focus trend, the day-length spread) come from the deterministic core via
  // `useBalance`; the self-report check-in is local-only (`useCheckin`), never uploaded.
  const bd = balance.data
  const load = bd?.load
  const loadPct = load && load.ratio !== null ? Math.round(load.ratio * 100) : null
  const trend = bd?.trend ?? []
  const dist = bd?.distribution ?? null
  const hoursLabel = (min: number): string => `${formatDuration(min * 60_000)} h`
  const balanceView = (
    <>
      <Card title="Balance" subtitle="From your own tracked time — a signal, never a diagnosis">
        {balance.loading && bd === null ? (
          <Text style={{ color: t.color.ink2 }}>Loading…</Text>
        ) : bd === null || !bd.hasData ? (
          <EmptyState
            title="No tracked time yet"
            hint="Track a few days and your workload, focus trend and day-length spread appear here — computed only from your own hours."
            compact
          />
        ) : (
          <View style={{ gap: t.spacing.s5 }}>
            {/* Balance row (design v14 §H): Work / Protected / Free over waking time (H1) + this
                week vs YOUR OWN normal (H3, never a fixed threshold). Protected is 0 until the
                life/🛡 persistence lands; the segment grows once that data flows. */}
            {(() => {
              const wb = weeklyBalance(trend)
              if (wb === null) return null
              const { row, band } = wb
              const seg = (frac: number, color: string): React.JSX.Element => (
                <View style={{ flex: Math.max(0, frac), backgroundColor: color }} />
              )
              const bandLabel =
                band === null
                  ? null
                  : band.band === 'above'
                    ? 'above your usual'
                    : band.band === 'below'
                      ? 'below your usual'
                      : 'in your usual range'
              const bandColor =
                band?.band === 'above'
                  ? t.color.warn
                  : band?.band === 'below'
                    ? t.color.ink3
                    : t.color.good
              return (
                <View style={{ gap: t.spacing.s2 }} accessibilityRole="summary">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text
                      style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}
                    >
                      Balance · work · protected · free
                    </Text>
                    {bandLabel !== null && (
                      <Text style={{ fontSize: t.fontSize['2xs'], color: bandColor }}>
                        {bandLabel}
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      height: 10,
                      borderRadius: 5,
                      overflow: 'hidden',
                      backgroundColor: t.color.sunk,
                    }}
                    accessibilityLabel={`Work ${formatDuration(row.workMin * 60_000)}, protected ${formatDuration(row.protectedMin * 60_000)}, free ${formatDuration(row.freeMin * 60_000)} of waking time${bandLabel !== null ? `; this week is ${bandLabel}` : ''}`}
                  >
                    {seg(row.workShare, t.color.accent)}
                    {seg(row.protectedShare, t.color.life)}
                    {seg(row.freeShare, t.color.ink3)}
                  </View>
                  <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                    {row.protectedMin === 0
                      ? 'Protected time appears once you flag life or 🛡 blocks. Assumes 16 waking hours a day.'
                      : 'Assumes 16 waking hours a day.'}
                  </Text>
                </View>
              )
            })()}
            {/* Passive signal 1: workload vs the week's target (neutral calm/steady/elevated). */}
            {loadPct !== null ? (
              <LoadMeter label="This week vs your target" value={loadPct} />
            ) : (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                Set a weekly target in Work Time to see this week&apos;s workload.
              </Text>
            )}
            {/* Passive signal 2: the trailing 10-week focus trend. */}
            <View style={{ gap: t.spacing.s2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, fontWeight: '500' }}>
                  Focus · last 10 weeks
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    color: t.color.ink3,
                  }}
                >
                  {`this week ${hoursLabel(trend[trend.length - 1] ?? 0)}`}
                </Text>
              </View>
              <Sparkline values={trend} width={300} height={44} />
            </View>
            {/* Passive signal 3: the spread of the days actually worked. */}
            {dist !== null && dist.max > dist.min ? (
              <View style={{ gap: t.spacing.s2 }}>
                <BoxPlot
                  label="Day length · shortest → longest"
                  min={dist.min}
                  q1={dist.q1}
                  median={dist.median}
                  q3={dist.q3}
                  max={dist.max}
                />
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize['2xs'],
                    color: t.color.ink3,
                  }}
                >
                  {`shortest ${hoursLabel(dist.min)} · median ${hoursLabel(dist.median)} · longest ${hoursLabel(dist.max)}`}
                </Text>
              </View>
            ) : dist !== null ? (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                {`Your tracked days are all about ${hoursLabel(dist.median)} long.`}
              </Text>
            ) : (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                A few more tracked days and the day-length spread appears here.
              </Text>
            )}
          </View>
        )}
      </Card>
      {/* Overtime compound (G3): the running balance over 8 weeks + a straight-line forecast. */}
      <Card title="Overtime compound" subtitle="Last 8 weeks · balance & forecast">
        {otrend.loading && otrend.data === null ? (
          <Text style={{ color: t.color.ink2 }}>Loading…</Text>
        ) : otrend.data === null || otrend.data.series.length < 2 ? (
          <EmptyState
            title="Not enough weeks yet"
            hint="A few weeks of tracked work time and your overtime trend, forecast and pattern note appear here."
            compact
          />
        ) : (
          <View style={{ gap: t.spacing.s3 }}>
            <Sparkline values={otrend.data.series.map(p => p.balanceMs)} width={300} height={44} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
              <View style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
                <StatTile label="Now" value={overtimeLabel(otrend.data.currentMs)} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
                <StatTile label="Forecast (+4 wk)" value={overtimeLabel(otrend.data.projectedMs)} />
              </View>
            </View>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>{otrend.data.note}</Text>
          </View>
        )}
      </Card>
      {/* Drift-Coach (KI1): grounded AI phrasing over the deterministic overtime facts. */}
      {otrend.data !== null && otrend.data.series.length >= 2 && (
        <InsightCard
          kind="coach"
          title="Drift Coach"
          subtitle="Grounded in your own overtime trend"
          cta="Ask the coach"
          facts={[
            otrend.data.note,
            `Current overtime balance: ${overtimeLabel(otrend.data.currentMs)}.`,
            `Forecast in 4 weeks if the pattern holds: ${overtimeLabel(otrend.data.projectedMs)}.`,
          ]}
        />
      )}
      {/* Self-report half of the honest signal — local-only by contract. */}
      <CheckinCard done={checkin.done} onSubmit={checkin.submit} />
    </>
  )

  // Guard: if the money view is hidden by the role, fall back to Overview.
  const effectiveView = view === 'money' && !showMoney ? 'overview' : view
  const body =
    effectiveView === 'money' ? moneyView : effectiveView === 'balance' ? balanceView : overviewView

  return (
    <ScreenScaffold
      header={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: t.spacing.s3,
          }}
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
          <View
            style={{
              flexDirection: 'row',
              gap: 2,
              backgroundColor: t.color.sunk,
              borderRadius: t.radius.pill,
              padding: 3,
            }}
          >
            {(
              [
                ['overview', 'Overview'],
                ...(showMoney ? ([['money', 'Revenue & Budget']] as const) : []),
                ['balance', 'Balance'],
              ] as const
            ).map(([v, label]) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={{
                  borderRadius: t.radius.pill,
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  backgroundColor: effectiveView === v ? t.color.surface : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSize['2xs'],
                    fontWeight: '700',
                    color: effectiveView === v ? t.color.ink : t.color.ink3,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button size="sm" variant="ghost" disabled>
            Export — coming soon
          </Button>
        </View>
      }
    >
      {/* Balance is a fixed ten-week retrospective, so the Week/Month/Year window
          selector only applies to the Overview and Revenue & Budget views. */}
      {view !== 'balance' && (
        <Tabs
          items={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
          active={range}
          onChange={value => setRange(value as Range)}
        />
      )}

      {body}
    </ScreenScaffold>
  )
}
