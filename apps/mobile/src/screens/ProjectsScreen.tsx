import { ScrollView, Text, View, useWindowDimensions } from 'react-native'
import {
  budgetTone,
  formatDuration,
  formatMoneyMinor,
  formatPercent,
  projectColor,
} from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, Card, ProgressBar } from '../components/index'

/**
 * Projects — clients → projects → tasks with budget consumption and rates
 * (ux-vision §3, issue #11). Every figure renders in tabular numerals via the
 * design `format*` helpers, and the budget bar/percent tone come from the pure
 * `budgetTone`/`barFraction` policy (ADR-0005) so the same ratio reads identically
 * here and in Reports. Data is illustrative until the sync/API slice feeds it;
 * project colors are assigned deterministically per id.
 */
interface Task {
  readonly id: string
  readonly name: string
  readonly spentMs: number
  readonly done?: boolean
}

interface Project {
  readonly id: string
  readonly name: string
  readonly budgetMs: number
  readonly spentMs: number
  readonly rateMinorPerHour: number
  readonly currency: string
  readonly tasks: readonly Task[]
}

interface Client {
  readonly id: string
  readonly name: string
  readonly projects: readonly Project[]
}

const H = 3_600_000

const CLIENTS: readonly Client[] = [
  {
    id: 'nexushero',
    name: 'NexusHero',
    projects: [
      {
        id: 'finanzo',
        name: 'Finanzo',
        budgetMs: 120 * H,
        spentMs: 78 * H + 30 * 60_000,
        rateMinorPerHour: 12_000,
        currency: 'EUR',
        tasks: [
          { id: 'f1', name: 'Ledger domain core', spentMs: 22 * H, done: true },
          { id: 'f2', name: 'Reconciliation UI', spentMs: 31 * H + 30 * 60_000 },
          { id: 'f3', name: 'CSV import', spentMs: 25 * H },
        ],
      },
      {
        id: 'sync-engine',
        name: 'Sync engine',
        budgetMs: 60 * H,
        spentMs: 58 * H,
        rateMinorPerHour: 12_000,
        currency: 'EUR',
        tasks: [
          { id: 's1', name: 'CRDT resolve', spentMs: 34 * H, done: true },
          { id: 's2', name: 'Convergence sim', spentMs: 24 * H },
        ],
      },
    ],
  },
  {
    id: 'nordwind',
    name: 'Nordwind GmbH',
    projects: [
      {
        id: 'nordwind',
        name: 'Website relaunch',
        budgetMs: 40 * H,
        spentMs: 44 * H,
        rateMinorPerHour: 9_500,
        currency: 'EUR',
        tasks: [
          { id: 'n1', name: 'Design system', spentMs: 18 * H, done: true },
          { id: 'n2', name: 'CMS migration', spentMs: 26 * H },
        ],
      },
    ],
  },
]

function ProjectCard({ project }: { project: Project }): React.JSX.Element {
  const t = useTheme()
  const ratio = project.budgetMs > 0 ? project.spentMs / project.budgetMs : 0
  const color = projectColor(project.id, t.mode)
  const cost = Math.round((project.spentMs / H) * project.rateMinorPerHour)
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }

  return (
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
        <Text style={{ marginLeft: 'auto', ...mono, fontSize: t.fontSize.sm, color: t.color.ink2 }}>
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
  )
}

export function ProjectsScreen(): React.JSX.Element {
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
        <Text style={{ fontWeight: '700', fontSize: t.fontSize.xl, color: t.color.ink }}>
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
                <ProjectCard project={project} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
