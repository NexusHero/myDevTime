import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { projectColor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import {
  INBOX_PROJECTS,
  INBOX_SORTERS,
  INBOX_SOURCES,
  INBOX_TAGS,
  type InboxSort,
  type InboxTask,
} from '../../screens/plannerInboxData'

/**
 * The Planner **Task-Inbox** rail (design v6): assigned tickets from Jira/Linear/
 * GitHub, searchable + filterable + sortable, grouped by project. "Plan" drops a
 * ticket into the next free slot as a ghost proposal; the check button marks it
 * done. Cross-calendar drag is deferred (#39/#117) — one-tap Plan is the path
 * for now. Purely presentational over the caller's task list.
 */
interface TaskInboxProps {
  readonly tasks: readonly InboxTask[]
  readonly onPlan: (task: InboxTask) => void
  readonly onDone: (task: InboxTask) => void
}

const PRIO_TONE = (prio: 1 | 2 | 3): 'crit' | 'warn' | 'ink3' =>
  prio === 1 ? 'crit' : prio === 2 ? 'warn' : 'ink3'

function FilterChip({
  label,
  active,
  onPress,
}: {
  readonly label: string
  readonly active: boolean
  readonly onPress: () => void
}): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: active ? t.color.accent : t.color.border,
        backgroundColor: active ? t.color.accentSoft : t.color.surface,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: active ? t.color.accentText : t.color.ink2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function TaskRow({
  task,
  open,
  onToggleOpen,
  onPlan,
  onDone,
}: {
  readonly task: InboxTask
  readonly open: boolean
  readonly onToggleOpen: () => void
  readonly onPlan: () => void
  readonly onDone: () => void
}): React.JSX.Element {
  const t = useTheme()
  const prioColor = t.color[PRIO_TONE(task.prio)]
  const dueColor =
    task.dueIn === undefined
      ? t.color.ink3
      : task.dueIn <= 2
        ? t.color.crit
        : task.dueIn <= 5
          ? t.color.warn
          : t.color.ink3
  return (
    <View>
      <Pressable
        onPress={onToggleOpen}
        accessibilityRole="button"
        accessibilityLabel={`${task.key} ${task.title}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          paddingVertical: 7,
          paddingHorizontal: 6,
          borderRadius: t.radius.block,
        }}
      >
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={`Done: ${task.key}`}
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            borderWidth: 1.5,
            borderColor: t.color.borderStrong,
          }}
        />
        <View
          style={{
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: task.prio === 1 ? prioColor : t.color.sunk,
          }}
        >
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: 8.5,
              fontWeight: '800',
              color: task.prio === 1 ? '#ffffff' : t.color.ink2,
            }}
          >
            P{task.prio}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontFamily: t.fontFamily.numeric, fontSize: 10, color: t.color.ink3 }}>
              {task.key}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: t.fontSize['2xs'],
                fontWeight: '600',
                color: t.color.ink,
              }}
            >
              {task.title}
            </Text>
            {task.due !== undefined && (
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: 9,
                  fontWeight: '700',
                  color: dueColor,
                }}
              >
                ▸ {task.due}
              </Text>
            )}
          </View>
        </View>
        <Text style={{ fontFamily: t.fontFamily.numeric, fontSize: 10, color: t.color.ink3 }}>
          {task.est}h
        </Text>
        <Button size="sm" onPress={onPlan}>
          Plan
        </Button>
      </Pressable>
      {open && (
        <View
          style={{
            marginHorizontal: 6,
            marginBottom: 6,
            padding: t.spacing.s2,
            borderRadius: t.radius.block,
            backgroundColor: t.color.sunk,
          }}
        >
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2, lineHeight: 18 }}>
            {task.desc}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: t.fontFamily.numeric,
              fontSize: 9,
              color: t.color.ink3,
            }}
          >
            P{task.prio} · {task.est}h · {task.tag} · {task.src}
            {task.due !== undefined ? ` · due ${task.due}` : ''}
          </Text>
        </View>
      )}
    </View>
  )
}

export function TaskInbox({ tasks, onPlan, onDone }: TaskInboxProps): React.JSX.Element {
  const t = useTheme()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<(typeof INBOX_TAGS)[number]>('All')
  const [source, setSource] = useState<(typeof INBOX_SOURCES)[number]>('All')
  const [sort, setSort] = useState<InboxSort>('prio')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const visible = tasks
    .filter(task => {
      const q = query.trim().toLowerCase()
      return (
        (tag === 'All' || task.tag === tag) &&
        (source === 'All' || task.src === source) &&
        (q === '' || `${task.key} ${task.title}`.toLowerCase().includes(q))
      )
    })
    .sort(INBOX_SORTERS[sort])

  return (
    <View
      style={{
        width: 288,
        alignSelf: 'stretch',
        borderWidth: 1,
        borderColor: t.color.border,
        borderRadius: t.radius.card,
        backgroundColor: t.color.surface,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          padding: t.spacing.s3,
          gap: t.spacing.s2,
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Text
            style={{
              fontFamily: t.fontFamily.display,
              fontWeight: '700',
              fontSize: t.fontSize.sm,
              color: t.color.ink,
            }}
          >
            Inbox
          </Text>
          <View
            style={{
              paddingHorizontal: t.spacing.s2,
              paddingVertical: 1,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.sunk,
            }}
          >
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: 10,
                fontWeight: '700',
                color: t.color.ink3,
              }}
            >
              {visible.length}
              {visible.length !== tasks.length ? `/${String(tasks.length)}` : ''}
            </Text>
          </View>
          <Text style={{ marginLeft: 'auto', fontSize: 9, color: t.color.ink3 }}>3 sources</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search (key, title)…"
          placeholderTextColor={t.color.ink3}
          style={{
            paddingHorizontal: t.spacing.s3,
            paddingVertical: t.spacing.s2,
            borderRadius: t.radius.block,
            borderWidth: 1,
            borderColor: t.color.borderStrong,
            backgroundColor: t.color.sunk,
            color: t.color.ink,
            fontSize: t.fontSize['2xs'],
            fontFamily: t.fontFamily.ui,
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {INBOX_TAGS.map(f => (
            <FilterChip key={f} label={f} active={tag === f} onPress={() => setTag(f)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: t.color.ink3 }}>Source</Text>
          {INBOX_SOURCES.map(f => (
            <FilterChip key={f} label={f} active={source === f} onPress={() => setSource(f)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: t.color.ink3 }}>Sort</Text>
          {(
            [
              ['prio', 'Priority'],
              ['due', 'Deadline'],
              ['est', 'Effort'],
              ['src', 'Source'],
            ] as const
          ).map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              active={sort === value}
              onPress={() => setSort(value)}
            />
          ))}
        </View>
      </View>

      <View style={{ padding: t.spacing.s2 }}>
        {INBOX_PROJECTS.map((project, pi) => {
          const group = visible.filter(task => task.project === pi)
          if (group.length === 0) return null
          return (
            <View key={project.name}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 6,
                  paddingTop: 9,
                  paddingBottom: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    backgroundColor: projectColor(project.id, t.mode),
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: t.color.ink2,
                    letterSpacing: 10 * t.letterSpacing.wide,
                    textTransform: 'uppercase',
                  }}
                >
                  {project.name}
                </Text>
                <Text
                  style={{ fontFamily: t.fontFamily.numeric, fontSize: 10, color: t.color.ink3 }}
                >
                  {group.length}
                </Text>
              </View>
              {group.map(task => (
                <TaskRow
                  key={task.key}
                  task={task}
                  open={openKey === task.key}
                  onToggleOpen={() => setOpenKey(k => (k === task.key ? null : task.key))}
                  onPlan={() => onPlan(task)}
                  onDone={() => onDone(task)}
                />
              ))}
            </View>
          )
        })}
        {visible.length === 0 && (
          <Text
            style={{
              padding: t.spacing.s4,
              textAlign: 'center',
              fontSize: t.fontSize['2xs'],
              color: t.color.ink3,
            }}
          >
            Nothing found — adjust filters or search.
          </Text>
        )}
      </View>
    </View>
  )
}
