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
 * Data is illustrative until the reporting API feeds it; the calendar heatmap is a
 * follow-up slice.
 */
const H = 3_600_000

interface ProjectReport {
  readonly id: string
  readonly name: string
  readonly ratio: number
  readonly spentMs: number
  readonly week: readonly number[]
}

const PROJECTS: readonly ProjectReport[] = [
  { id: 'finanzo', name: 'Finanzo', ratio: 0.65, spentMs: 78 * H, week: [6, 5, 7, 8, 6, 2, 0] },
  {
    id: 'sync-engine',
    name: 'Sync engine',
    ratio: 0.97,
    spentMs: 58 * H,
    week: [4, 6, 5, 9, 7, 3, 1],
  },
  {
    id: 'nordwind',
    name: 'Website relaunch',
    ratio: 1.1,
    spentMs: 44 * H,
    week: [3, 4, 2, 5, 6, 4, 2],
  },
]

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

  // Tracked total + per-project sparklines come from the summary endpoint; budget
  // rings, billable money and overtime stay demo until billing/work-time is wired.
  const trackedMs = reports.data?.totalMs ?? WEEK_TOTAL_MS
  const byProject = reports.data?.byProject ?? []

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
          <Metric label="Billable" value={formatMoneyMinor(BILLABLE_MINOR, 'EUR')} />
          <View style={{ alignItems: 'center' }}>
            <Gauge value={OVERTIME_MS / H} range={OVERTIME_RANGE_H} label="Overtime balance" />
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
              Overtime {formatDuration(OVERTIME_MS)} h
            </Text>
          </View>
        </View>
      </Card>

      {/* Budget rings */}
      <View>
        <SectionLabel>Budgets</SectionLabel>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: t.spacing.s5,
              justifyContent: 'space-around',
            }}
          >
            {PROJECTS.map(p => (
              <View key={p.id} style={{ alignItems: 'center', gap: t.spacing.s2, width: 96 }}>
                <BudgetRing ratio={p.ratio} label={p.name} />
                <Text
                  style={{ fontSize: t.fontSize.sm, color: t.color.ink, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize.xs,
                    color: t.color.ink2,
                  }}
                >
                  {formatDuration(p.spentMs)} h
                </Text>
              </View>
            ))}
          </View>
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
