import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { formatDuration, formatMoneyMinor, formatPercent, projectColor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import {
  BudgetRing,
  Button,
  Card,
  EmptyState,
  ScreenScaffold,
  StatTile,
  Tabs,
} from '../components/index'
import { useReports } from '../hooks/useReports'
import { useRevenueBudget } from '../hooks/useRevenueBudget'
import { rangeLabel, type ReportRange } from '../reports/window'
import type { ClientRevenueRow } from '../reports/revenueBudget'
import type { AgingKey, OpenAging } from '../api/invoicing'

/**
 * Reports (REQ-005/009, ux-vision §3) — the figures for the selected window
 * (Week/Month/Year) are the live `useReports` resource's (ADR-0005): Worked, Revenue,
 * Overtime balance, the per-project distribution and the budget rings, all computed by
 * the deterministic core over that window. There is no fabricated data: with no tracked
 * time the cards show their empty state, and the analytics that have no live source yet
 * (workload, burn-down, day-length distribution, heatmap, check-in) show an honest
 * "coming soon" placeholder rather than demo numbers. Every figure renders through the
 * pure formatters in `@mydevtime/design`.
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
  const [view, setView] = useState<'overview' | 'money'>('overview')
  const reports = useReports(range)
  const rb = useRevenueBudget(range)
  const label = rangeLabel(range)

  const data = reports.data
  const trackedMs = data?.totalMs ?? 0
  const revenueMinor = data?.billableMinor ?? 0
  const currencyCode = data?.currencyCode ?? 'EUR'
  const overtimeMs = data?.overtimeMs ?? 0
  const budgets = data?.budgets ?? []
  const distItems: readonly DistItem[] = (data?.byProject ?? []).map(p => ({
    id: p.id,
    name: p.name,
    ms: p.spentMs,
  }))

  const loading = reports.loading && data === null
  const error = reports.error !== null && data === null ? reports.error : null

  const soon = (title: string, hint: string): React.JSX.Element => (
    <Card title={title}>
      <EmptyState title="Coming soon" hint={hint} compact />
    </Card>
  )

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
      {soon(
        'More analytics',
        'Workload, budget burn-down, day-length distribution, heatmap and weekly check-in appear here once their aggregation is live.',
      )}
    </>
  )

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
                ['money', 'Revenue & Budget'],
              ] as const
            ).map(([v, label]) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={{
                  borderRadius: t.radius.pill,
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  backgroundColor: view === v ? t.color.surface : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSize['2xs'],
                    fontWeight: '700',
                    color: view === v ? t.color.ink : t.color.ink3,
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
      <Tabs
        items={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        active={range}
        onChange={value => setRange(value as Range)}
      />

      {view === 'money' ? moneyView : overviewView}
    </ScreenScaffold>
  )
}
