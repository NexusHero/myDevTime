import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '../components/core/Text'
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Row,
  ScreenScaffold,
  SegmentedControl,
  Switch,
} from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { useRules } from '../hooks/useRules'
import type { Rule, RuleAction, RuleInput, RuleMatcher } from '../api/rules'
import { useCatalog } from './useCatalog'
import { confirmDestructive } from '../utils/confirmDestructive'

/**
 * Categorization rules (REQ-011, ADR-0005) — the deterministic "if a new entry looks like *this*,
 * propose *that* category" engine. The user composes an ordered list of `matcher → action` rules;
 * the server evaluates them (first match wins) and only ever **proposes** — nothing here books a
 * number. This screen lists the rules and creates/toggles/deletes them via `useRules`. With no
 * API configured the list is simply empty (the app fabricates no rules).
 */
type SourceChoice = 'any' | 'timer' | 'manual' | 'calendar'
type BillableChoice = 'unset' | 'billable' | 'nonbillable'

export function RulesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const rules = useRules()
  const catalog = useCatalog()

  const clients = catalog.data ?? []
  const projectOpts = clients.flatMap(c =>
    c.projects.map(p => ({ id: p.id, label: `${c.name} · ${p.name}` })),
  )
  const projectName = new Map(projectOpts.map(o => [o.id, o.label]))

  const [note, setNote] = useState('')
  const [source, setSource] = useState<SourceChoice>('any')
  const [projectIsEmpty, setProjectIsEmpty] = useState(false)
  const [setProjectId, setSetProjectId] = useState<string | null>(null)
  const [tags, setTags] = useState('')
  const [billable, setBillable] = useState<BillableChoice>('unset')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildMatcher = (): RuleMatcher => {
    const m: RuleMatcher = {}
    if (note.trim() !== '') m.noteContains = note.trim()
    if (source !== 'any') m.sourceIs = source
    if (projectIsEmpty) m.projectIsEmpty = true
    return m
  }
  const buildAction = (): RuleAction => {
    const a: RuleAction = {}
    if (setProjectId !== null) a.setProjectId = setProjectId
    const parsed = tags
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
    if (parsed.length > 0) a.addTags = parsed
    if (billable === 'billable') a.setBillable = true
    if (billable === 'nonbillable') a.setBillable = false
    return a
  }

  const matcher = buildMatcher()
  const action = buildAction()
  // A rule must both test something and do something — an empty matcher matches everything and an
  // empty action proposes nothing, so require at least one condition and one effect.
  const hasCondition = Object.keys(matcher).length > 0
  const hasEffect = Object.keys(action).length > 0
  const canSave = !saving && rules.live && hasCondition && hasEffect

  const message = (e: unknown): string =>
    e instanceof Error && e.message ? e.message : 'Rule could not be saved. Please try again.'

  const resetForm = (): void => {
    setNote('')
    setSource('any')
    setProjectIsEmpty(false)
    setSetProjectId(null)
    setTags('')
    setBillable('unset')
  }

  const save = (): void => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    const input: RuleInput = { order: rules.data?.length ?? 0, matcher, action }
    rules
      .create(input)
      .then(resetForm)
      .catch((e: unknown) => {
        setError(message(e))
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const toggleEnabled = (r: Rule): void => {
    if (!rules.live) return
    setError(null)
    rules.update(r.id, { enabled: !r.enabled }).catch((e: unknown) => {
      setError(message(e))
    })
  }

  const removeRule = (r: Rule): void => {
    confirmDestructive({
      title: 'Delete rule?',
      message:
        'Delete this categorization rule? Entries already categorized keep their provenance.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        setError(null)
        rules.remove(r.id).catch((e: unknown) => {
          setError(message(e))
        })
      },
    })
  }

  const matcherSummary = (m: RuleMatcher): string => {
    const parts: string[] = []
    if (m.noteContains !== undefined) parts.push(`note ~ “${m.noteContains}”`)
    if (m.sourceIs !== undefined) parts.push(`source = ${m.sourceIs}`)
    if (m.projectIsEmpty === true) parts.push('no project yet')
    return parts.length > 0 ? parts.join(' · ') : 'matches everything'
  }
  const actionSummary = (a: RuleAction): string => {
    const parts: string[] = []
    if (a.setProjectId !== undefined)
      parts.push(`→ ${projectName.get(a.setProjectId) ?? 'project'}`)
    if (a.addTags !== undefined && a.addTags.length > 0) parts.push(`+${a.addTags.join(', ')}`)
    if (a.setBillable === true) parts.push('billable')
    if (a.setBillable === false) parts.push('non-billable')
    return parts.length > 0 ? parts.join(' · ') : 'proposes nothing'
  }

  const header = (
    <SubScreenHeader
      title="Categorization rules"
      subtitle="Auto-propose a category for matching entries"
      onBack={onBack}
    />
  )

  const label = { fontSize: t.fontSize.xs, color: t.color.ink3, marginBottom: t.spacing.s1 }
  const list = rules.data ?? []

  return (
    <ScreenScaffold header={header}>
      <Card title="Add a rule">
        <View style={{ gap: t.spacing.s3 }}>
          <View>
            <Text style={label}>Note contains</Text>
            <Input value={note} onChangeText={setNote} placeholder="e.g. standup" />
          </View>

          <View>
            <Text style={label}>Source is</Text>
            <SegmentedControl<SourceChoice>
              segments={[
                { value: 'any', label: 'Any' },
                { value: 'timer', label: 'Timer' },
                { value: 'manual', label: 'Manual' },
                { value: 'calendar', label: 'Calendar' },
              ]}
              active={source}
              onChange={setSource}
            />
          </View>

          <Row
            title="Only uncategorized"
            subtitle="Match entries that have no project yet"
            trailing={
              <Switch
                checked={projectIsEmpty}
                onChange={setProjectIsEmpty}
                accessibilityLabel="Only uncategorized"
              />
            }
          />

          <View>
            <Text style={label}>Set project</Text>
            {projectOpts.length === 0 ? (
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink3 }}>No projects yet.</Text>
            ) : (
              <View style={{ gap: t.spacing.s1 }}>
                {projectOpts.map(o => {
                  const on = o.id === setProjectId
                  return (
                    <Row
                      key={o.id}
                      title={o.label}
                      onPress={() => setSetProjectId(on ? null : o.id)}
                      trailing={
                        on ? <Icon name="check" size={16} color={t.color.accent} /> : undefined
                      }
                    />
                  )
                })}
              </View>
            )}
          </View>

          <View>
            <Text style={label}>Add tags (comma separated)</Text>
            <Input value={tags} onChangeText={setTags} placeholder="meeting, internal" />
          </View>

          <View>
            <Text style={label}>Billable</Text>
            <SegmentedControl<BillableChoice>
              segments={[
                { value: 'unset', label: 'Leave' },
                { value: 'billable', label: 'Billable' },
                { value: 'nonbillable', label: 'Non-billable' },
              ]}
              active={billable}
              onChange={setBillable}
            />
          </View>

          <Button onPress={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save rule'}
          </Button>
          {hasCondition && !hasEffect && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              Add an effect (project, tags or billable) so the rule proposes something.
            </Text>
          )}
          {error !== null && (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: t.fontSize.sm, color: t.color.crit }}
            >
              {error}
            </Text>
          )}
          {!rules.live && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              Connect a workspace to save rules — this is a preview.
            </Text>
          )}
        </View>
      </Card>

      <Card title="Your rules">
        {list.length === 0 ? (
          <EmptyState
            title="No rules yet"
            hint="Add a rule to auto-propose a category for matching entries."
          />
        ) : (
          <View style={{ gap: t.spacing.s1 }}>
            {list.map((r, i) => (
              <Row
                key={r.id}
                title={`${String(i + 1)}. ${matcherSummary(r.matcher)}`}
                subtitle={actionSummary(r.action)}
                trailing={
                  rules.live ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                      <Switch
                        checked={r.enabled}
                        onChange={() => toggleEnabled(r)}
                        accessibilityLabel={`Enable rule ${String(i + 1)}`}
                      />
                      <IconButton
                        icon={<Icon name="x" size={16} color={t.color.ink3} />}
                        label={`Delete rule ${String(i + 1)}`}
                        onPress={() => removeRule(r)}
                      />
                    </View>
                  ) : undefined
                }
              />
            ))}
          </View>
        )}
      </Card>
    </ScreenScaffold>
  )
}
