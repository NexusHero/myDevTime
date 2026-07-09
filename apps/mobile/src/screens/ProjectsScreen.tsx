import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Text } from '../components/core/Text'
import {
  budgetTone,
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  projectColor,
  type Screen,
} from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, Card, ProgressBar } from '../components/index'
import { CLIENTS, type Project } from './projectsData'

/**
 * Projects — clients → projects → tasks with budget consumption and rates
 * (ux-vision §3, issue #11). Every figure renders in tabular numerals via the
 * design `format*` helpers, and the budget bar/percent tone come from the pure
 * `budgetTone`/`barFraction` policy (ADR-0005). A card opens the project detail;
 * data is illustrative (see `projectsData`) until the tracking API feeds it.
 */
const H = 3_600_000

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project
  onOpen: () => void
}): React.JSX.Element {
  const t = useTheme()
  const ratio = project.budgetMs > 0 ? project.spentMs / project.budgetMs : 0
  const color = projectColor(project.id, t.mode)
  const cost = Math.round((project.spentMs / H) * project.rateMinorPerHour)
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
    >
      <Card
        title={project.name}
        action={<Badge tone={budgetTone(ratio)}>{formatPercent(ratio)}</Badge>}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            accessibilityElementsHidden
          />
          <Text style={{ ...mono, fontSize: t.fontSize.sm }}>
            {formatDuration(project.spentMs)}
            <Text style={{ color: t.color.ink3 }}> / {formatDuration(project.budgetMs)}</Text>
          </Text>
          <Text
            style={{ marginLeft: 'auto', ...mono, fontSize: t.fontSize.sm, color: t.color.ink2 }}
          >
            {formatMoneyMinor(cost, project.currency)}
          </Text>
        </View>

        <View style={{ marginTop: t.spacing.s3 }}>
          <ProgressBar ratio={ratio} label={`${project.name} budget consumption`} />
        </View>

        <View style={{ marginTop: t.spacing.s4, gap: t.spacing.s2 }}>
          {project.tasks.map(task => (
            <View
              key={task.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: task.done ? t.color.good : t.color.border,
                }}
                accessibilityElementsHidden
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: t.fontSize.sm,
                  color: task.done ? t.color.ink3 : t.color.ink,
                  textDecorationLine: task.done ? 'line-through' : 'none',
                }}
                numberOfLines={1}
              >
                {task.name}
              </Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  color: t.color.ink2,
                }}
              >
                {formatDuration(task.spentMs)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  )
}

export function ProjectsScreen({
  onNavigate,
}: {
  onNavigate: (screen: Screen, params?: Record<string, string>) => void
}): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const columns = width >= 1040 ? 2 : 1
  const projectCount = CLIENTS.reduce((n, c) => n + c.projects.length, 0)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <View>
        <Text
          style={{
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
          }}
        >
          Projects
        </Text>
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
          {CLIENTS.length} clients · {projectCount} active projects
        </Text>
      </View>

      {CLIENTS.map(client => (
        <View key={client.id} style={{ gap: t.spacing.s3 }}>
          <Text
            style={{
              fontSize: t.fontSize.xs,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: t.color.ink3,
            }}
          >
            {client.name}
          </Text>
          <View
            style={{
              flexDirection: columns === 2 ? 'row' : 'column',
              flexWrap: columns === 2 ? 'wrap' : 'nowrap',
              gap: t.spacing.s4,
            }}
          >
            {client.projects.map(project => (
              <View
                key={project.id}
                style={columns === 2 ? { flexBasis: '48%', flexGrow: 1 } : { alignSelf: 'stretch' }}
              >
                <ProjectCard
                  project={project}
                  onOpen={() => onNavigate('project', { projectId: project.id })}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
