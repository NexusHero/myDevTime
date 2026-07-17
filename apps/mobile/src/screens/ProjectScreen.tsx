import { ScrollView, View } from 'react-native'
import {
  budgetTone,
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  projectColor,
  type Screen,
} from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, BudgetRing, Card, InsightCard, Row } from '../components/index'
import { PlanVarianceChip } from '../components/reports/PlanVarianceChip'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { findProject } from './projectsData'
import { useCatalog } from './useCatalog'
import { quoteFacts } from '../insights/quoteFacts'

/**
 * Project detail (REQ-001/005, ux-vision §3) — the drill-down from the Projects
 * list: budget consumption as a ring, the money story (cost to date, hourly rate,
 * remaining budget), and the task breakdown that opens a task. Every figure comes
 * from the design `format*` helpers and the pure `budgetTone`/`ringDashOffset`
 * policy (ADR-0005), so a ratio reads identically here, on the list, and in
 * Reports.
 */
const H = 3_600_000

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{label}</Text>
      <Text
        style={{
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize.md,
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

export function ProjectScreen({
  projectId,
  onNavigate,
  onBack,
}: {
  projectId: string
  onNavigate: (screen: Screen, params?: Record<string, string>) => void
  onBack: () => void
}): React.JSX.Element {
  const t = useTheme()
  const catalog = useCatalog()
  const found = findProject(catalog.data ?? [], projectId)

  if (!found) {
    const message =
      catalog.loading && catalog.data === null
        ? 'Loading project…'
        : catalog.error
          ? `Couldn’t load the project — ${catalog.error.message}`
          : 'This project could not be found.'
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.color.bg }}
        contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
      >
        <SubScreenHeader title="Project" backLabel="Projects" onBack={onBack} />
        <Card>
          <Text style={{ color: catalog.error ? t.color.crit : t.color.ink2 }}>{message}</Text>
        </Card>
      </ScrollView>
    )
  }

  const { project, client } = found
  const ratio = project.budgetMs > 0 ? project.spentMs / project.budgetMs : 0
  const cost = Math.round((project.spentMs / H) * project.rateMinorPerHour)
  const remainingMs = Math.max(project.budgetMs - project.spentMs, 0)
  const color = projectColor(project.id, t.mode)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <SubScreenHeader
        title={project.name}
        subtitle={client.name}
        backLabel="Projects"
        onBack={onBack}
      />

      <Card action={<Badge tone={budgetTone(ratio)}>{formatPercent(ratio)}</Badge>}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s5 }}>
          <BudgetRing ratio={ratio} label={`${project.name} budget`} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s4 }}>
            <Stat label="Tracked" value={`${formatDuration(project.spentMs)} h`} />
            <Stat label="Budget" value={`${formatDuration(project.budgetMs)} h`} />
            <Stat label="Remaining" value={`${formatDuration(remainingMs)} h`} />
            <Stat label="Cost to date" value={formatMoneyMinor(cost, project.currency)} />
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            marginTop: t.spacing.s4,
            paddingTop: t.spacing.s3,
            borderTopWidth: 1,
            borderTopColor: t.color.border,
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            accessibilityElementsHidden
          />
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>Hourly rate</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.sm,
              color: t.color.ink,
            }}
          >
            {formatMoneyMinor(project.rateMinorPerHour, project.currency)} / h
          </Text>
        </View>

        {/* Fixed-fee revenue plan vs realized (design v17 §K4): only for a fixed-fee project.
            Realized is the cost to date (tracked value); the deterministic core owns the %. */}
        {typeof project.fixedFeeMinor === 'number' && project.fixedFeeMinor > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              marginTop: t.spacing.s3,
            }}
          >
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>Fixed fee</Text>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.sm,
                color: t.color.ink,
              }}
            >
              {formatMoneyMinor(project.fixedFeeMinor, project.currency)}
            </Text>
            <View style={{ marginLeft: 'auto' }}>
              <PlanVarianceChip expectedMinor={project.fixedFeeMinor} realizedMinor={cost} />
            </View>
          </View>
        )}
      </Card>

      <View>
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
          Tasks · {String(project.tasks.length)}
        </Text>
        <Card>
          {project.tasks.map(task => (
            <Row
              key={task.id}
              title={task.name}
              subtitle={task.done ? 'Done' : 'In progress'}
              leading={
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: task.done ? t.color.good : color,
                  }}
                  accessibilityElementsHidden
                />
              }
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize.sm,
                      color: t.color.ink2,
                    }}
                  >
                    {formatDuration(task.spentMs)}
                  </Text>
                  <Text style={{ color: t.color.ink3, fontSize: t.fontSize.lg }}>›</Text>
                </View>
              }
              onPress={() => onNavigate('task', { taskId: task.id })}
            />
          ))}
        </Card>

        {/* KI2 — a quote grounded in this project's own task-duration history (design v13). */}
        {(() => {
          const facts = quoteFacts(
            project.tasks.map(task => task.spentMs).filter(ms => ms > 0),
            { ratePerHourMinor: project.rateMinorPerHour, currency: project.currency },
          )
          if (facts.length === 0) return null
          return (
            <View style={{ marginTop: t.spacing.s4 }}>
              <InsightCard
                kind="quote"
                title="Quote from history"
                subtitle="Grounded in how long similar tasks took here"
                cta="Draft a quote"
                facts={facts}
              />
            </View>
          )
        })()}
      </View>
    </ScrollView>
  )
}
