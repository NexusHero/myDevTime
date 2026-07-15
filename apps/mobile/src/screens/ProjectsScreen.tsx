import { useState } from 'react'
import { Linking, Pressable, View, useWindowDimensions } from 'react-native'
import { Text } from '../components/core/Text'
import {
  boundedList,
  budgetTone,
  formatDuration,
  formatMoneyMinor,
  projectColor,
  type Screen,
} from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, BudgetRing, Button, Card, EmptyState, ScreenScaffold } from '../components/index'
import type { Client, Project } from './projectsData'
import { useCatalog } from './useCatalog'
import { useClientsOpen } from '../hooks/useClientsOpen'
import { InvoiceDrawer, type DrawerClient } from '../components/invoicing/InvoiceDrawer'
import { invoiceExportUrl, voidInvoice, type IssuedInvoiceDTO } from '../api/invoicing'
import { apiBaseUrl } from '../config'

/**
 * Projects — clients → projects → tasks with budget consumption and rates
 * (ux-vision §3, issue #11). The data comes live from `useCatalog`; with no API
 * the list is empty. Every figure renders via the design `format*` helpers and the
 * pure `budgetTone` policy (ADR-0005). Cards without budget data (the live catalog
 * carries structure + rates only, for now) degrade to a task-count + rate summary.
 * A card opens the detail.
 */
/** Up to two leading initials of a project name, for the card avatar. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }
  const billing =
    project.rateMinorPerHour > 0
      ? `${formatMoneyMinor(project.rateMinorPerHour, project.currency)} / h`
      : `${String(project.tasks.length)} Tasks`

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${project.name}`}
    >
      <Card>
        {/* Header: project avatar (soft tint of the project color) + name + billing line + budget warning */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: `${color}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityElementsHidden
          >
            <Text
              style={{
                fontFamily: t.fontFamily.display,
                fontWeight: '700',
                fontSize: t.fontSize.sm,
                color,
              }}
            >
              {initials(project.name)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontWeight: '700', fontSize: t.fontSize.md, color: t.color.ink }}
            >
              {project.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}
            >
              {billing}
            </Text>
          </View>
          {budgetTone(ratio) !== 'good' && <Badge tone="warn">Budget tight</Badge>}
        </View>

        {/* Budget ring + Booked/Budget + weekly-trend footer; degrades without a budget cap */}
        {hasBudget ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s4,
              marginTop: t.spacing.s4,
            }}
          >
            <BudgetRing ratio={ratio} size={72} label={`${project.name} budget`} />
            <View style={{ flex: 1, minWidth: 0, gap: t.spacing.s2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Booked</Text>
                <Text style={{ ...mono, fontSize: t.fontSize.xs, fontWeight: '600' }}>
                  {formatDuration(project.spentMs)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Budget</Text>
                <Text style={{ ...mono, fontSize: t.fontSize.xs, fontWeight: '600' }}>
                  {formatDuration(project.budgetMs)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: t.spacing.s4 }}>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>No budget cap</Text>
          </View>
        )}

        {/* Tasks (live) — a compact drill-down preview kept from the catalog wiring */}
        {project.tasks.length > 0 && (
          <View
            style={{
              marginTop: t.spacing.s4,
              paddingTop: t.spacing.s3,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
              gap: t.spacing.s2,
            }}
          >
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
        )}
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

/** Budget consumption ratio for risk sorting — projects without a cap sink to 0. */
function budgetRisk(project: Project): number {
  return project.budgetMs > 0 ? project.spentMs / project.budgetMs : 0
}

export function ProjectsScreen({
  onNavigate,
}: {
  onNavigate: (screen: Screen, params?: Record<string, string>) => void
}): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const columns = width >= 1040 ? 2 : 1
  const [expanded, setExpanded] = useState(false)
  const catalog = useCatalog()
  const clients: readonly Client[] = catalog.data ?? []

  // Open (un-invoiced) billable work, live from the invoicing rollup (design v6,
  // ADR-0051) — the freelancer's "was ist noch abzurechnen?" at a glance.
  const open = useClientsOpen()
  const openMinor = (open.data?.clients ?? []).reduce((s, c) => s + c.openMinor, 0)
  const openMs = (open.data?.clients ?? []).reduce((s, c) => s + c.openMs, 0)
  const currencyCode = open.data?.currencyCode ?? 'EUR'

  // Names for the drawer: client id → name, project id → name (from the catalog).
  const nameByClient = new Map(clients.map(c => [c.id, c.name]))
  const nameByProject = new Map(clients.flatMap(c => c.projects).map(p => [p.id, p.name]))
  const drawerClients: DrawerClient[] = (open.data?.clients ?? []).map(c => ({
    clientId: c.clientId,
    name: nameByClient.get(c.clientId) ?? 'Client',
    openMs: c.openMs,
    openMinor: c.openMinor,
  }))

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [issued, setIssued] = useState<IssuedInvoiceDTO | null>(null)
  // "Minute 1" preview (design v6 C9): a header toggle that shows the first-start
  // empty state, so the first-run experience is one tap away without wiping data.
  const [preview, setPreview] = useState(false)
  // Local narrowing of the module-level base URL for the export closure.
  const exportBase = apiBaseUrl

  const onIssued = (invoice: IssuedInvoiceDTO): void => {
    setIssued(invoice)
    open.reload()
  }
  const undoIssue = (): void => {
    if (apiBaseUrl !== null && issued !== null) {
      void voidInvoice(apiBaseUrl, issued.id).then(() => open.reload())
    }
    setIssued(null)
  }

  // Bounded screen (design v1): one flat list sorted by budget risk, the top few
  // visible and the rest behind a "+N more" drill-in — scroll depth never
  // grows with the project count. The limit follows the column count.
  const sorted = [...clients.flatMap(c => c.projects)].sort((a, b) => budgetRisk(b) - budgetRisk(a))
  const limit = columns === 2 ? 6 : 3
  const { shown, hidden } = boundedList(sorted, limit, expanded)

  const subtitle = catalog.loading
    ? 'Loading…'
    : catalog.error
      ? 'Could not load'
      : 'by budget risk'

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
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
      {sorted.length > 0 && (
        <View
          style={{
            paddingVertical: 2,
            paddingHorizontal: t.spacing.s2,
            borderRadius: t.radius.pill,
            backgroundColor: t.color.sunk,
          }}
        >
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize['2xs'],
              fontWeight: '700',
              color: t.color.ink2,
            }}
          >
            {sorted.length}
          </Text>
        </View>
      )}
      <Pressable
        onPress={() => setPreview(p => !p)}
        accessibilityRole="switch"
        accessibilityState={{ checked: preview }}
        accessibilityLabel="Minute 1 preview"
        style={{
          marginLeft: 'auto',
          paddingVertical: 3,
          paddingHorizontal: t.spacing.s2,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: preview ? t.color.accent : t.color.border,
          backgroundColor: preview ? t.color.accentSoft : t.color.surface,
        }}
      >
        <Text
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '700',
            color: preview ? t.color.accentText : t.color.ink3,
          }}
        >
          Minute 1
        </Text>
      </Pressable>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>{subtitle}</Text>
    </View>
  )

  if (preview) {
    return (
      <ScreenScaffold header={header}>
        <EmptyState
          title="No projects yet"
          hint="Add your first client and a project — then time, budgets, and invoicing come together here. This is what the start looks like with no data."
          action={
            <Button size="sm" onPress={() => setPreview(false)}>
              See an example
            </Button>
          }
        />
      </ScreenScaffold>
    )
  }

  return (
    <ScreenScaffold header={header}>
      {open.live && openMs > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Open billable</Text>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.lg,
                  fontWeight: '700',
                  color: t.color.ink,
                }}
              >
                {formatDuration(openMs)} h · {formatMoneyMinor(openMinor, currencyCode)}
              </Text>
            </View>
            <Button size="sm" onPress={() => setDrawerOpen(true)}>
              Invoice
            </Button>
          </View>
        </Card>
      )}

      {issued !== null && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
            <Text
              style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.good, fontWeight: '600' }}
            >
              Invoiced · {formatMoneyMinor(issued.totalMinor, issued.currencyCode)}
            </Text>
            {exportBase !== null && (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => void Linking.openURL(invoiceExportUrl(exportBase, issued.id))}
              >
                CSV
              </Button>
            )}
            <Button size="sm" variant="ghost" onPress={undoIssue}>
              Undo
            </Button>
          </View>
        </Card>
      )}

      <InvoiceDrawer
        open={drawerOpen}
        clients={drawerClients}
        currencyCode={currencyCode}
        nameByProject={nameByProject}
        onClose={() => setDrawerOpen(false)}
        onIssued={onIssued}
      />

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

      {!catalog.loading && !catalog.error && sorted.length === 0 && (
        <Notice title="No projects yet">Create a client and project to start tracking.</Notice>
      )}

      <View
        style={{
          flexDirection: columns === 2 ? 'row' : 'column',
          flexWrap: columns === 2 ? 'wrap' : 'nowrap',
          gap: t.spacing.s4,
        }}
      >
        {shown.map(project => (
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

      {(hidden > 0 || expanded) && sorted.length > limit && (
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Button size="sm" variant="secondary" onPress={() => setExpanded(e => !e)}>
            {expanded ? 'Show less' : `+${String(hidden)} show more`}
          </Button>
        </View>
      )}
    </ScreenScaffold>
  )
}
