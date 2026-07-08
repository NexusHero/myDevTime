import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { moveFocus, resolve, type Mode } from './keymap.js'

/**
 * Q3 surface: a keyboard-first entries table on react-native-web. RNW renders to
 * the real DOM, so `onKeyDown` carries genuine keyboard events; we route them
 * through the pure `resolve()` model (tested separately) and never hard-code
 * behaviour in the view. j/k move, n adds, e/Enter edits, ⌘Enter saves, Esc
 * cancels, / focuses search. On native this same screen still works by touch.
 */
interface Row {
  id: string
  note: string
  hours: string
}
const SEED: Row[] = [
  { id: '1', note: 'Kickoff call', hours: '1.00' },
  { id: '2', note: 'Sync engine review', hours: '2.50' },
  { id: '3', note: 'PDF export', hours: '0.75' },
]

export function EntriesDashboard(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(SEED)
  const [focus, setFocus] = useState(0)
  const [mode, setMode] = useState<Mode>('list')
  const [draft, setDraft] = useState('')

  const onKey = useCallback(
    (key: string, meta: boolean, shift: boolean) => {
      const intent = resolve({ key, meta, shift }, mode)
      switch (intent) {
        case 'moveDown':
          setFocus(f => moveFocus(f, 1, rows.length))
          break
        case 'moveUp':
          setFocus(f => moveFocus(f, -1, rows.length))
          break
        case 'newEntry': {
          const id = String(rows.length + 1)
          setRows(r => [...r, { id, note: '', hours: '0.00' }])
          setFocus(rows.length)
          setMode('editing')
          setDraft('')
          break
        }
        case 'editFocused':
          setMode('editing')
          setDraft(rows[focus]?.note ?? '')
          break
        case 'save':
          setRows(r => r.map((row, i) => (i === focus ? { ...row, note: draft } : row)))
          setMode('list')
          break
        case 'cancel':
          setMode('list')
          break
        case 'openSearch':
          setMode('search')
          break
        default:
          break
      }
    },
    [mode, rows, focus, draft],
  )

  // Web: attach a document-level key listener so the whole dashboard is drivable
  // from the keyboard without a focused input. Native ignores this branch.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (mode === 'list' && target?.tagName === 'INPUT') return
      onKey(e.key, e.metaKey || e.ctrlKey, e.shiftKey)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [onKey, mode])

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Entries · keyboard-first</Text>
      <Text style={styles.legend}>j/k move · n new · e edit · ⌘↵ save · esc cancel · / search</Text>
      {rows.map((row, i) => (
        <Pressable key={row.id} onPress={() => setFocus(i)} style={[styles.row, i === focus && styles.focused]}>
          {mode === 'editing' && i === focus ? (
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onKeyPress={e => onKey(e.nativeEvent.key, false, false)}
              style={styles.input}
              placeholder="Description"
            />
          ) : (
            <Text style={styles.note}>{row.note || <Text style={styles.muted}>— empty —</Text>}</Text>
          )}
          <Text style={styles.hours}>{row.hours} h</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 6, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 22, fontWeight: '700' },
  legend: { color: '#888', marginBottom: 8, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focused: { borderColor: '#2563eb', backgroundColor: '#2563eb11' },
  note: { fontSize: 16 },
  muted: { color: '#bbb' },
  hours: { fontVariant: ['tabular-nums'], color: '#444' },
  input: { fontSize: 16, flex: 1, paddingVertical: 2, outlineStyle: 'none' } as object,
})
