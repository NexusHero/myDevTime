import { useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
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

/**
 * Reports (REQ-005/009, ux-vision §3) — the trailing-week figures are the live
 * `useReports` resource's (ADR-0005): Gearbeitet, Umsatz, Überstunden-Saldo, the
 * per-project distribution and the budget rings, all computed by the deterministic
 * core. There is no fabricated data: with no tracked time the cards show their
 * empty state, and the analytics that have no live source yet (Monat/Jahr,
 * Belastung, Burn-down, Tageslängen-Verteilung, Heatmap, Check-in) show an honest
 * "bald verfügbar" placeholder rather than demo numbers. Every figure renders
 * through the pure formatters in `@mydevtime/design`.
 */
type Range = 'week' | 'month' | 'year'

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

export function ReportsScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 720
  const reports = useReports()

  const [range, setRange] = useState<Range>('week')
  const isWeek = range === 'week'

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
      <EmptyState title="Bald verfügbar" hint={hint} compact />
    </Card>
  )

  const summaryTiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
      {[
        { key: 'worked', label: 'Gearbeitet · Woche', value: `${formatDuration(trackedMs)} h` },
        { key: 'revenue', label: 'Umsatz', value: formatMoneyMinor(revenueMinor, currencyCode) },
        { key: 'saldo', label: 'Überstunden-Saldo', value: overtimeLabel(overtimeMs) },
      ].map(tile => (
        <View key={tile.key} style={{ flexGrow: 1, flexBasis: stacked ? '45%' : 0, minWidth: 150 }}>
          <StatTile label={tile.label} value={tile.value} />
        </View>
      ))}
    </View>
  )

  const distributionCard = (
    <Card title="Wohin ging die Zeit?" subtitle="Woche · nach Projekt" style={{ flex: 1 }}>
      {loading ? (
        <Text style={{ color: t.color.ink2 }}>Wird geladen …</Text>
      ) : error !== null ? (
        <Text style={{ color: t.color.crit }}>
          Reports konnten nicht geladen werden — {error.message}
        </Text>
      ) : distItems.length === 0 ? (
        <Text style={{ color: t.color.ink2 }}>Noch keine Zeit in diesem Zeitraum erfasst.</Text>
      ) : (
        <Distribution items={distItems} />
      )}
    </Card>
  )

  const budgetsCard = (
    <Card title="Budgets" subtitle="Woche · Verbrauch nach Projekt">
      {loading ? (
        <Text style={{ color: t.color.ink2 }}>Wird geladen …</Text>
      ) : budgets.length === 0 ? (
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
          <Button size="sm" variant="ghost" disabled>
            Export — bald verfügbar
          </Button>
        </View>
      }
    >
      <Tabs
        items={[
          { value: 'week', label: 'Woche' },
          { value: 'month', label: 'Monat' },
          { value: 'year', label: 'Jahr' },
        ]}
        active={range}
        onChange={value => setRange(value as Range)}
      />

      {isWeek ? (
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
            'Weitere Auswertungen',
            'Belastung, Budget-Burn-down, Tageslängen-Verteilung, Heatmap und Wochen-Check-in erscheinen hier, sobald ihre Aggregation live ist.',
          )}
        </>
      ) : (
        soon(
          range === 'month' ? 'Monatsauswertung' : 'Jahresauswertung',
          'Die Auswertung über diesen Zeitraum erscheint hier, sobald die Aggregation live ist. Die Wochenansicht ist bereits mit deinen echten Daten verbunden.',
        )
      )}
    </ScreenScaffold>
  )
}
