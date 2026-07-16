import { useEffect, useMemo, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '../components/core/Text'
import { useTheme } from '../theme/ThemeProvider'
import { filterCommands, type Command, type CommandAction } from './commands.js'

/**
 * The Command Bar (design v10 §D11): a global palette for the timer, the punch clock,
 * "start on <project>" and navigation — reachable from anywhere without a context
 * switch. The command list is the pure `buildCommands`/`filterCommands`; this renders
 * it, drives keyboard selection (web: ⌘K opens it from the shell, arrows/enter/esc
 * here) and dispatches each pick's typed action to the real seams via `onRun`.
 */
export interface CommandBarProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly commands: readonly Command[]
  readonly onRun: (action: CommandAction) => void
}

/**
 * The palette's inner panel (input + grouped list + web keyboard nav), without the
 * modal shell — so it renders in tests without react-native's `Modal`. Rendered only
 * while the bar is open.
 */
export function CommandBarPanel({
  onClose,
  commands,
  onRun,
}: Omit<CommandBarProps, 'open'>): React.JSX.Element {
  const t = useTheme()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)

  const list = useMemo(() => filterCommands(commands, query), [commands, query])
  const cur = Math.min(sel, Math.max(list.length - 1, 0))

  const run = (action: CommandAction): void => {
    onClose()
    onRun(action)
  }

  // Web keyboard navigation (native uses taps).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel(s => Math.min(s + 1, list.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel(s => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        const pick = list[cur]
        if (pick) {
          e.preventDefault()
          run(pick.action)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [list, cur])

  let lastGroup: string | null = null
  return (
    <Pressable
      onPress={() => undefined}
      style={{
        width: '92%',
        maxWidth: 560,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.borderStrong,
        borderRadius: t.radius.card,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          paddingHorizontal: t.spacing.s4,
          paddingVertical: t.spacing.s3,
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        <TextInput
          autoFocus
          value={query}
          onChangeText={text => {
            setQuery(text)
            setSel(0)
          }}
          placeholder="What do you want to do?"
          placeholderTextColor={t.color.ink3}
          style={{
            flex: 1,
            fontFamily: t.fontFamily.ui,
            fontSize: t.fontSize.md,
            color: t.color.ink,
          }}
        />
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: t.color.ink3,
            borderWidth: 1,
            borderColor: t.color.border,
            borderRadius: 5,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          esc
        </Text>
      </View>

      <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
        {list.length === 0 ? (
          <Text style={{ padding: t.spacing.s4, fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            Nothing found for “{query}”.
          </Text>
        ) : (
          list.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null
            lastGroup = c.group
            const selected = i === cur
            return (
              <View key={c.id}>
                {header !== null && (
                  <Text
                    style={{
                      paddingHorizontal: t.spacing.s4,
                      paddingTop: t.spacing.s3,
                      paddingBottom: 2,
                      fontSize: t.fontSize['2xs'],
                      fontWeight: '700',
                      color: t.color.ink3,
                      textTransform: 'uppercase',
                      letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
                    }}
                  >
                    {header}
                  </Text>
                )}
                <Pressable
                  onPress={() => run(c.action)}
                  onHoverIn={() => setSel(i)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.s2,
                    paddingHorizontal: t.spacing.s4,
                    paddingVertical: t.spacing.s3,
                    backgroundColor: selected ? t.color.sunk : 'transparent',
                  }}
                >
                  {c.action.type === 'start-project' ? (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 3,
                        backgroundColor: t.color.accent,
                      }}
                    />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.ink }}
                  >
                    {c.label}
                  </Text>
                  {selected && (
                    <Text
                      style={{
                        fontFamily: t.fontFamily.numeric,
                        fontSize: t.fontSize['2xs'],
                        color: t.color.ink3,
                      }}
                    >
                      ↵
                    </Text>
                  )}
                </Pressable>
              </View>
            )
          })
        )}
      </ScrollView>
    </Pressable>
  )
}

export function CommandBar({
  open,
  onClose,
  commands,
  onRun,
}: CommandBarProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          paddingTop: '14%',
        }}
      >
        <CommandBarPanel onClose={onClose} commands={commands} onRun={onRun} />
      </Pressable>
    </Modal>
  )
}
