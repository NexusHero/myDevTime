import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { formatMoneyMinor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Row,
  ScreenScaffold,
  SegmentedControl,
} from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { useRates } from '../hooks/useRates'
import { eurosToMinor, type Rate, type RateLevel } from '../api/rates'
import { useCatalog } from './useCatalog'

/**
 * Hourly rates (REQ-005) — the one place to manage the workspace's rate rules the
 * `billing` module prices invoices with. Rates are effective-dated and scoped
 * (workspace default → client → project, most specific wins); this screen lists
 * them by level and creates/deletes them via `useRates`. The user only types €/h —
 * the effective date is stamped "now" — and the deterministic core owns the math
 * (ADR-0005). Demo data stands in when no API is configured.
 */
const CURRENCY = 'EUR' // one workspace currency at 1.0 (multi-currency is backlog)

export function RatesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const rates = useRates()
  const catalog = useCatalog()

  const clients = catalog.data ?? []
  const clientOpts = clients.map(c => ({ id: c.id, label: c.name }))
  const projectOpts = clients.flatMap(c =>
    c.projects.map(p => ({ id: p.id, label: `${c.name} · ${p.name}` })),
  )
  const clientName = new Map(clientOpts.map(o => [o.id, o.label]))
  const projectName = new Map(projectOpts.map(o => [o.id, o.label]))

  const rateLabel = (r: Rate): string => {
    if (r.level === 'client') return clientName.get(r.scopeId ?? '') ?? 'Client'
    if (r.level === 'project') return projectName.get(r.scopeId ?? '') ?? 'Project'
    if (r.level === 'task') return 'Task'
    return 'Workspace default'
  }
  const money = (minor: number): string => `${formatMoneyMinor(minor, CURRENCY)} / h`

  const [level, setLevel] = useState<RateLevel>('workspace')
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsScope = level === 'client' || level === 'project'
  const minor = eurosToMinor(amount)
  const canSave = !saving && minor !== null && (!needsScope || scopeId !== null)
  const options = level === 'client' ? clientOpts : level === 'project' ? projectOpts : []

  const message = (e: unknown): string =>
    e instanceof Error && e.message ? e.message : 'Rate could not be saved. Please try again.'

  const save = (): void => {
    if (minor === null || (needsScope && scopeId === null)) return
    setSaving(true)
    setError(null)
    rates
      .create({
        level,
        scopeId: needsScope ? scopeId : null,
        amountMinorPerHour: minor,
        effectiveFrom: new Date().toISOString(),
      })
      .then(() => {
        setAmount('')
        setScopeId(null)
      })
      .catch((e: unknown) => {
        // Surface the failure — a silent write is worse than a visible error.
        setError(message(e))
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const removeRate = (id: string): void => {
    setError(null)
    rates.remove(id).catch((e: unknown) => {
      setError(message(e))
    })
  }

  const list = rates.data ?? []
  const byLevel = (lvl: RateLevel): readonly Rate[] => list.filter(r => r.level === lvl)

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s2 }}>
      <View style={{ flex: 1 }}>
        <SubScreenHeader
          title="Hourly rates"
          subtitle="Set €/h per workspace, client or project"
          onBack={onBack}
        />
      </View>
      {!rates.live && <Badge tone="neutral">Demo data</Badge>}
    </View>
  )

  const label = { fontSize: t.fontSize.xs, color: t.color.ink3, marginBottom: t.spacing.s1 }

  return (
    <ScreenScaffold header={header}>
      <Card title="Add a rate">
        <View style={{ gap: t.spacing.s3 }}>
          <View>
            <Text style={label}>Applies to</Text>
            <SegmentedControl<RateLevel>
              segments={[
                { value: 'workspace', label: 'Workspace' },
                { value: 'client', label: 'Client' },
                { value: 'project', label: 'Project' },
              ]}
              active={level}
              onChange={v => {
                setLevel(v)
                setScopeId(null)
              }}
            />
          </View>

          {needsScope && (
            <View>
              <Text style={label}>{level === 'client' ? 'Client' : 'Project'}</Text>
              {options.length === 0 ? (
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink3 }}>
                  No {level === 'client' ? 'clients' : 'projects'} yet.
                </Text>
              ) : (
                <View style={{ gap: t.spacing.s1 }}>
                  {options.map(o => {
                    const on = o.id === scopeId
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setScopeId(o.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={{
                          padding: t.spacing.s3,
                          borderRadius: t.radius.block,
                          borderWidth: 1,
                          borderColor: on ? t.color.accent : t.color.border,
                          backgroundColor: on ? t.color.accentSoft : t.color.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: t.fontSize.sm,
                            color: on ? t.color.accentText : t.color.ink,
                          }}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          <View>
            <Text style={label}>Rate (€/h)</Text>
            <Input
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="numeric"
              mono
            />
          </View>

          <Button onPress={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save rate'}
          </Button>
          {error !== null && (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: t.fontSize.sm, color: t.color.crit }}
            >
              {error}
            </Text>
          )}
          {!rates.live && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              Connect a workspace to save rates — this is a preview.
            </Text>
          )}
        </View>
      </Card>

      <Card title="Current rates">
        {list.length === 0 ? (
          <EmptyState title="No rates yet" hint="Add a workspace default to get started." />
        ) : (
          <View style={{ gap: t.spacing.s4 }}>
            {(['workspace', 'client', 'project'] as const).map(lvl => {
              const rows = byLevel(lvl)
              if (rows.length === 0) return null
              const heading =
                lvl === 'workspace'
                  ? 'Workspace default'
                  : lvl === 'client'
                    ? 'Per client'
                    : 'Per project'
              return (
                <View key={lvl} style={{ gap: t.spacing.s1 }}>
                  <Text style={label}>{heading}</Text>
                  {rows.map(r => (
                    <Row
                      key={r.id}
                      title={rateLabel(r)}
                      subtitle={money(r.amountMinorPerHour)}
                      trailing={
                        rates.live ? (
                          <IconButton
                            icon={<Icon name="x" size={16} color={t.color.ink3} />}
                            label={`Remove rate ${rateLabel(r)}`}
                            onPress={() => removeRate(r.id)}
                          />
                        ) : undefined
                      }
                    />
                  ))}
                </View>
              )
            })}
          </View>
        )}
      </Card>
    </ScreenScaffold>
  )
}
