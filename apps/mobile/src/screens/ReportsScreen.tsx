import { ScrollView, View, useWindowDimensions } from 'react-native'
import { Text } from '../components/core/Text'
import { formatDuration, formatMoneyMinor, projectColor } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, BudgetRing, Card, Gauge, Sparkline } from '../components/index'
import { useReports } from '../hooks/useReports'

/**
 * Reports — "stats that read like instruments" (ux-vision §2.5): budget rings per
 * project, the overtime balance gauge, and small-multiple week sparklines. Every
 * figure renders in tabular numerals and every instrument is driven by the pure
 * geometry in `@mydevtime/design` (ADR-0005), so the SVG matches the numbers.
 * Tracked time, per-project sparklines, billable money and budget rings are fed by
 * the API (`useReports`); the overtime gauge stays illustrative until the work-time
 * read is wired, and the calendar heatmap is a follow-up slice.
 */
const H = 3_600_000

const WEEK_TOTAL_MS = 41 * H + 15 * 60_000
const BILLABLE_MINOR = 486_000
const OVERTIME_MS = 9 * H + 30 * 60_000
const OVERTIME_RANGE_H = 20

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{label}</Text>
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize.lg,
          fontWeight: '700',
          color: t.color.ink,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Text
      style={{
        fontSize: t.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: t.color.ink3,
        marginBottom: t.spacing.s2,
      }}
    >
      {children}
    </Text>
  )
}

export function ReportsScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const reports = useReports()

  // Tracked total, per-project sparklines, billable money and budget rings come
  // from the API; only the overtime gauge stays demo until the work-time read is
  // wired.
  const trackedMs = reports.data?.totalMs ?? WEEK_TOTAL_MS
  const billableMinor = reports.data?.billableMinor ?? BILLABLE_MINOR
  const currencyCode = reports.data?.currencyCode ?? 'EUR'
  const byProject = reports.data?.byProject ?? []
  const budgets = reports.data?.budgets ?? []

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s2 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize.xl,
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
            }}
          >
            Reports
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
            This week
          </Text>
        </View>
        {!reports.live && <Badge tone="neutral">Demo data</Badge>}
      </View>

      {/* Summary + overtime gauge */}
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: t.spacing.s5,
          }}
        >
          <Metric label="Tracked this week" value={`${formatDuration(trackedMs)} h`} />
          <Metric label="Billable" value={formatMoneyMinor(billableMinor, currencyCode)} />
          <View style={{ alignItems: 'center' }}>
            <Gauge value={OVERTIME_MS / H} range={OVERTIME_RANGE_H} label="Overtime balance" />
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
              Overtime {formatDuration(OVERTIME_MS)} h
            </Text>
          </View>
        </View>
      </Card>

      {/* Budget rings — driven by the budgets + status endpoints. */}
      <View>
        <SectionLabel>Budgets</SectionLabel>
        <Card>
          {budgets.length === 0 ? (
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
      </View>

      {/* Week sparklines (small multiples) — driven by the summary endpoint. */}
      <View>
        <SectionLabel>This week by project</SectionLabel>
        <Card>
          {reports.loading && reports.data === null ? (
            <Text style={{ color: t.color.ink2 }}>Loading…</Text>
          ) : reports.error ? (
            <Text style={{ color: t.color.crit }}>
              Couldn’t load reports — {reports.error.message}
            </Text>
          ) : byProject.length === 0 ? (
            <Text style={{ color: t.color.ink2 }}>No time tracked this week yet.</Text>
          ) : (
            <View style={{ gap: t.spacing.s4 }}>
              {byProject.map(p => {
                const lastMs = p.daily[p.daily.length - 1] ?? 0
                return (
                  <View
                    key={p.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s4 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.spacing.s2,
                        width: wide ? 200 : 130,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: projectColor(p.id, t.mode),
                        }}
                        accessibilityElementsHidden
                      />
                      <Text
                        style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.ink }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </View>
                    <Sparkline
                      values={[...p.daily]}
                      color={projectColor(p.id, t.mode)}
                      label={`${p.name} this week`}
                      width={wide ? 200 : 120}
                    />
                    <Text
                      style={{
                        marginLeft: 'auto',
                        fontFamily: t.fontFamily.numeric,
                        fontSize: t.fontSize.sm,
                        color: t.color.ink2,
                      }}
                    >
                      {formatDuration(lastMs)} h
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </Card>
      </View>
    </ScrollView>
  )
}
