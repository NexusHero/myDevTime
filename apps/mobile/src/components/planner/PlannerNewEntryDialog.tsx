import { useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import type { Priority } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button, Input, SegmentedControl } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The Planner **New-Entry** dialog (design v19). One creation surface for the two things a
 * developer plans by hand: a **Task** (work — a title, a project, a priority and an effort
 * estimate) or **Life** (personal — family, errands; never work time, ADR-0005 / design v19 §F).
 * The dialog is presentational and invents nothing: it collects a draft and hands it to the
 * Planner, which persists it as a real recurring series (`createSeries`) and places it — the AI
 * never books, the client never fabricates. Projects come live from the workspace catalog, with
 * an inline quick-add that persists a new project through the same real API.
 */

/** Priority choices, most-urgent first (maps to the design's High / Med / Low). */
const PRIORITIES: readonly { readonly value: Priority; readonly label: string }[] = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Med' },
  { value: 3, label: 'Low' },
]

/** Effort presets in hours (design v19: 30m · 1h · 2h · 3h+). */
const EFFORTS: readonly { readonly value: number; readonly label: string }[] = [
  { value: 0.5, label: '30m' },
  { value: 1, label: '1h' },
  { value: 2, label: '2h' },
  { value: 3, label: '3h+' },
]

/** A project the picker can assign to — id (for color + persistence) and its display name. */
export interface DialogProject {
  readonly id: string
  readonly name: string
}

/** The validated draft the Planner turns into a real persisted entry. */
export interface NewEntryDraft {
  readonly title: string
  readonly description: string
  /** A personal (life) entry — never counted as work time (design v19 §F). */
  readonly isLife: boolean
  /** The chosen project id, or null for Life / no project. */
  readonly projectId: string | null
  readonly priority: Priority
  readonly estHours: number
}

export interface PlannerNewEntryDialogProps {
  /** Whether the dialog is shown. */
  readonly visible: boolean
  /** Live workspace projects for the picker (empty is fine — a Task can be project-less). */
  readonly projects: readonly DialogProject[]
  readonly onClose: () => void
  /** Emit the validated draft; the Planner persists + places it. */
  readonly onSubmit: (draft: NewEntryDraft) => void
  /** Quick-add: persist a brand-new project by name (design v19 project picker "＋"). */
  readonly onCreateProject?: (name: string) => void
  /** True while a create request is in flight — disables the actions. */
  readonly busy?: boolean
}

export function PlannerNewEntryDialog({
  visible,
  projects,
  onClose,
  onSubmit,
  onCreateProject,
  busy = false,
}: PlannerNewEntryDialogProps): React.JSX.Element | null {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLife, setIsLife] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [priority, setPriority] = useState<Priority>(2)
  const [estHours, setEstHours] = useState(1)
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  if (!visible) return null

  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0 && !busy

  const reset = (): void => {
    setTitle('')
    setDescription('')
    setIsLife(false)
    setProjectId(null)
    setPriority(2)
    setEstHours(1)
    setAddingProject(false)
    setNewProjectName('')
  }

  const close = (): void => {
    reset()
    onClose()
  }

  const submit = (): void => {
    if (!canSubmit) return
    onSubmit({
      title: trimmed,
      description: description.trim(),
      isLife,
      projectId: isLife ? null : projectId,
      priority,
      estHours,
    })
    reset()
  }

  const addProject = (): void => {
    const name = newProjectName.trim()
    if (name.length === 0) return
    onCreateProject?.(name)
    setNewProjectName('')
    setAddingProject(false)
  }

  const panelWidth = Math.min(420, width - 24)

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 210 }}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close new entry"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          bottom: 12,
          width: panelWidth,
          backgroundColor: t.color.bg,
          borderWidth: 1,
          borderColor: t.color.border,
          borderRadius: 16,
          overflow: 'hidden',
          elevation: 12,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: t.spacing.s5,
            paddingVertical: t.spacing.s4,
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <Text style={{ flex: 1, fontSize: t.fontSize.xl, fontWeight: '700', color: t.color.ink }}>
            {isLife ? 'New life entry' : 'New task'}
          </Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink3 }}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type: Task vs Life */}
          <SegmentedControl<'task' | 'life'>
            segments={[
              { value: 'task', label: 'Task' },
              { value: 'life', label: 'Life' },
            ]}
            active={isLife ? 'life' : 'task'}
            onChange={v => setIsLife(v === 'life')}
          />

          <Input
            label="Title"
            placeholder={isLife ? 'e.g. School pickup' : 'e.g. SEPA export'}
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label="Description"
            placeholder="Optional detail"
            value={description}
            onChangeText={setDescription}
          />

          {/* Project + priority only apply to work; Life is personal and carries neither. */}
          {!isLife && (
            <>
              <View style={{ gap: t.spacing.s2 }}>
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
                  Project
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
                  {projects.map(p => {
                    const on = p.id === projectId
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setProjectId(on ? null : p.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={p.name}
                        style={{
                          paddingHorizontal: t.spacing.s3,
                          paddingVertical: t.spacing.s2,
                          borderRadius: t.radius.pill,
                          borderWidth: 1,
                          borderColor: on ? t.color.accent : t.color.border,
                          backgroundColor: on ? t.color.accentSoft : t.color.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: t.fontSize.sm,
                            color: on ? t.color.accentText : t.color.ink2,
                          }}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    )
                  })}
                  {onCreateProject !== undefined && !addingProject && (
                    <Pressable
                      onPress={() => setAddingProject(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Add project"
                      style={{
                        paddingHorizontal: t.spacing.s3,
                        paddingVertical: t.spacing.s2,
                        borderRadius: t.radius.pill,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: t.color.border,
                      }}
                    >
                      <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink3 }}>
                        + New project
                      </Text>
                    </Pressable>
                  )}
                </View>
                {addingProject && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.s2 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="New project name"
                        placeholder="e.g. Website relaunch"
                        value={newProjectName}
                        onChangeText={setNewProjectName}
                      />
                    </View>
                    <Button size="sm" variant="secondary" onPress={addProject}>
                      Add
                    </Button>
                  </View>
                )}
              </View>

              <View style={{ gap: t.spacing.s2 }}>
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
                  Priority
                </Text>
                <SegmentedControl<string>
                  segments={PRIORITIES.map(p => ({ value: String(p.value), label: p.label }))}
                  active={String(priority)}
                  onChange={v => setPriority(Number.parseInt(v, 10) as Priority)}
                />
              </View>
            </>
          )}

          {/* Effort estimate — the block length; drives the load bar for a task. */}
          <View style={{ gap: t.spacing.s2 }}>
            <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
              Effort
            </Text>
            <SegmentedControl<string>
              segments={EFFORTS.map(e => ({ value: String(e.value), label: e.label }))}
              active={String(estHours)}
              onChange={v => setEstHours(Number.parseFloat(v))}
            />
          </View>
        </ScrollView>

        {/* Footer actions */}
        <View
          style={{
            flexDirection: 'row',
            gap: t.spacing.s3,
            padding: t.spacing.s4,
            borderTopWidth: 1,
            borderTopColor: t.color.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button variant="ghost" fullWidth onPress={close}>
              Cancel
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="primary" fullWidth disabled={!canSubmit} onPress={submit}>
              {isLife ? 'Add to day' : 'Create task'}
            </Button>
          </View>
        </View>
      </View>
    </View>
  )
}
