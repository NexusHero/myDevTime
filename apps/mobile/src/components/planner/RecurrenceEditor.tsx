import { View } from 'react-native'
import {
  describeRecurrence,
  type RecurrenceEnd,
  type RecurrenceFreq,
  type RecurrenceRule,
} from '@mydevtime/domain'
import { Text } from '../core/Text'
import { Input, SegmentedControl } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The ↻ recurrence editor (REQ-060, design v17 §F4): a controlled control for a series rule —
 * a frequency (none / daily-weekdays / weekly / monthly) and, when it repeats, an end
 * (never / until a date / after N times). Presentation only: it emits a `RecurrenceRule`; the
 * caller persists it (the deterministic occurrence math is the server's, ADR-0005). The plain
 * label under it is the domain's `describeRecurrence`, so the wording never drifts from the core.
 */
const FREQ_SEGMENTS: readonly { readonly value: RecurrenceFreq; readonly label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

type EndKind = RecurrenceEnd['kind']
const END_SEGMENTS: readonly { readonly value: EndKind; readonly label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'until', label: 'Until' },
  { value: 'count', label: 'Count' },
]

export interface RecurrenceEditorProps {
  readonly value: RecurrenceRule
  readonly onChange: (rule: RecurrenceRule) => void
}

export function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps): React.JSX.Element {
  const t = useTheme()

  const setFreq = (freq: RecurrenceFreq): void => {
    // Leaving "Once" drops the end; a non-repeating rule has no end to speak of.
    onChange(freq === 'none' ? { freq, end: { kind: 'never' } } : { freq, end: value.end })
  }

  const setEndKind = (kind: EndKind): void => {
    const end: RecurrenceEnd =
      kind === 'until'
        ? { kind: 'until', date: value.end.kind === 'until' ? value.end.date : '' }
        : kind === 'count'
          ? { kind: 'count', count: value.end.kind === 'count' ? value.end.count : 1 }
          : { kind: 'never' }
    onChange({ freq: value.freq, end })
  }

  return (
    <View style={{ gap: t.spacing.s3 }}>
      <SegmentedControl segments={FREQ_SEGMENTS} active={value.freq} onChange={setFreq} />

      {value.freq !== 'none' && (
        <SegmentedControl segments={END_SEGMENTS} active={value.end.kind} onChange={setEndKind} />
      )}

      {value.freq !== 'none' && value.end.kind === 'until' && (
        <Input
          label="Until"
          placeholder="YYYY-MM-DD"
          value={value.end.kind === 'until' ? value.end.date : ''}
          onChangeText={date => onChange({ freq: value.freq, end: { kind: 'until', date } })}
          mono
        />
      )}

      {value.freq !== 'none' && value.end.kind === 'count' && (
        <Input
          label="Times"
          placeholder="1"
          keyboardType="numeric"
          value={value.end.kind === 'count' ? String(value.end.count) : ''}
          onChangeText={text => {
            const n = Number.parseInt(text, 10)
            onChange({
              freq: value.freq,
              end: { kind: 'count', count: Number.isFinite(n) && n > 0 ? n : 1 },
            })
          }}
          mono
        />
      )}

      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
        {`↻ ${describeRecurrence(value)}`}
      </Text>
    </View>
  )
}
