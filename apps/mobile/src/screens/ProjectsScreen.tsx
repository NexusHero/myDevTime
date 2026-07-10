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
import { Badge, Button, Card, ProgressBar } from '../components/index'
import type { Client, Project } from './projectsData'
import { useCatalog } from './useCatalog'

/**
 * Projects — clients → projects → tasks with budget consumption and rates
 * (ux-vision §3, issue #11). The data comes from `useCatalog`: the live tracking
 * catalog when an API is configured, else the illustrative demo data. Every figure
 * renders via the design `format*` helpers and the pure `budgetTone` policy
 * (ADR-0005). Cards without budget data (the live catalog carries structure + rates
 * only, for now) degrade to a task-count + rate summary. A card opens the detail.
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
  const color = projectColor(project.id, t.mode)
  const hasBudget = project.budgetMs > 0
  const ratio = hasBudget ? project.spentMs / project.budgetMs : 0
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
        action={
          hasBudget ? <Badge tone={budgetTone(ratio)}>{formatPercent(ratio)}</Badge> : undefined
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
            accessibilityElementsHidden
          />
          {hasBudget ? (
            <>
              <Text style={{ ...mono, fontSize: t.fontSize.sm }}>
                {formatDuration(project.spentMs)}
                <Text style={{ color: t.color.ink3 }}> / {formatDuration(project.budgetMs)}</Text>
              </Text>
              <Text
                style={{
                  marginLeft: 'auto',
                  ...mono,
                  fontSize: t.fontSize.sm,
                  color: t.color.ink2,
                }}
              >
                {formatMoneyMinor(cost, project.currency)}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
                {String(project.tasks.length)} tasks
              </Text>
              {project.rateMinorPerHour > 0 && (
                <Text
                  style={{
                    marginLeft: 'auto',
                    ...mono,
                    fontSize: t.fontSize.sm,
                    color: t.color.ink2,
                  }}
                >
                  {formatMoneyMinor(project.rateMinorPerHour, project.currency)} / h
                </Text>
              )}
            </>
          )}
        </View>

        {hasBudget && (
          <View style={{ marginTop: t.spacing.s3 }}>
            <ProgressBar ratio={ratio} label={`${project.name} budget consumption`} />
          </View>
        )}

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
              {task.spentMs > 0 && (
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize.xs,
                    color: t.color.ink2,
                  }}
                >
                  {formatDuration(task.spentMs)}
                </Text>
              )}
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  )
}

function Notice({ title, children }: { title: string; children?: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Card title={title}>
      {children !== undefined && (
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{children}</Text>
      )}
    </Card>
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
  const catalog = useCatalog()
  const clients: readonly Client[] = catalog.data ?? []
  const projectCount = clients.reduce((n, c) => n + c.projects.length, 0)

  const subtitle = catalog.loading
    ? 'Loading…'
    : catalog.error
      ? 'Could not load'
      : `${String(clients.length)} clients · ${String(projectCount)} active projects`

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.s3 }}>
        <View style={{ flex: 1 }}>
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
            {subtitle}
          </Text>
        </View>
        {!catalog.live && <Badge tone="neutral">Demo data</Badge>}
      </View>

      {catalog.loading && catalog.data === null && <Notice title="Loading projects…" />}

      {catalog.error && (
        <Card title="Couldn’t load projects">
          <Text
            style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginBottom: t.spacing.s3 }}
          >
            {catalog.error.message}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Button size="sm" variant="secondary" onPress={catalog.reload}>
              Retry
            </Button>
          </View>
        </Card>
      )}

      {!catalog.loading && !catalog.error && clients.length === 0 && (
        <Notice title="No projects yet">Create a client and project to start tracking.</Notice>
      )}

      {clients.map(client => (
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
