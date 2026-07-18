import { useState } from 'react'
import { Pressable, View } from 'react-native'
import {
  baselineRange,
  estimateVsActual,
  resolveEstimate,
  type TaskCategory,
  type TaskComplexity,
} from '@mydevtime/domain'
import { Text } from '../core/Text'
import { Button, Input } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Task effort-estimation card (REQ-041, ADR-0021/0005). The user picks a **category** and
 * **complexity** and optionally types their **own** estimate; everything shown is computed by the
 * deterministic `estimating/effort` core — a baseline **hours range** (no false precision), the
 * effective estimate (the user's number wins over the baseline, with provenance), and — once the
 * task is tracked — estimate-vs-actual. Nothing is fabricated: without a category/complexity there
 * is no baseline, and the card says so. Saving hands the raw inputs to the Planner, which persists
 * them via the real task API; the AI **review** (assist-only, never mutating the number) is a
 * separate follow-up.
 */
const CATEGORIES: readonly TaskCategory[] = ['feature', 'bug', 'chore', 'research', 'meeting']
const COMPLEXITIES: readonly TaskComplexity[] = ['trivial', 'small', 'medium', 'large', 'xlarge']

function asCategory(v: string | null | undefined): TaskCategory | null {
  return v != null && (CATEGORIES as readonly string[]).includes(v) ? (v as TaskCategory) : null
}
function asComplexity(v: string | null | undefined): TaskComplexity | null {
  return v != null && (COMPLEXITIES as readonly string[]).includes(v) ? (v as TaskComplexity) : null
}

export interface TaskEstimateCardProps {
  readonly category: string | null
  readonly complexity: string | null
  /** The user's own estimate in minutes (null = none). */
  readonly estimateMinutes: number | null
  /** Actual tracked time on the task, milliseconds — the estimate-vs-actual denominator. */
  readonly spentMs: number
  readonly busy?: boolean
  readonly onSave: (patch: {
    category: string | null
    complexity: string | null
    estimateMinutes: number | null
  }) => void
}

export function TaskEstimateCard({
  category,
  complexity,
  estimateMinutes,
  spentMs,
  busy = false,
  onSave,
}: TaskEstimateCardProps): React.JSX.Element {
  const t = useTheme()
  const [cat, setCat] = useState<TaskCategory | null>(asCategory(category))
  const [cx, setCx] = useState<TaskComplexity | null>(asComplexity(complexity))
  const [hoursText, setHoursText] = useState(
    estimateMinutes != null ? String(estimateMinutes / 60) : '',
  )

  const userHours = ((): number | null => {
    const n = Number.parseFloat(hoursText.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : null
  })()

  const resolved = cat != null && cx != null ? resolveEstimate(cat, cx, userHours) : null
  const range = cat != null && cx != null ? baselineRange(cat, cx) : null
  const actualHours = spentMs / 3_600_000
  const vsActual =
    resolved != null && spentMs > 0 ? estimateVsActual(resolved.effectiveHours, actualHours) : null

  const chip = (active: boolean): object => ({
    paddingHorizontal: t.spacing.s3,
    paddingVertical: t.spacing.s2,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: active ? t.color.accent : t.color.border,
    backgroundColor: active ? t.color.accentSoft : t.color.surface,
  })

  return (
    <View
      style={{
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
        Effort estimate
      </Text>

      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
        {CATEGORIES.map(c => (
          <Pressable
            key={c}
            onPress={() => setCat(prev => (prev === c ? null : c))}
            accessibilityRole="button"
            accessibilityState={{ selected: cat === c }}
            accessibilityLabel={c}
            style={chip(cat === c)}
          >
            <Text
              style={{
                fontSize: t.fontSize.xs,
                color: cat === c ? t.color.accentText : t.color.ink2,
              }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Complexity</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
        {COMPLEXITIES.map(c => (
          <Pressable
            key={c}
            onPress={() => setCx(prev => (prev === c ? null : c))}
            accessibilityRole="button"
            accessibilityState={{ selected: cx === c }}
            accessibilityLabel={c}
            style={chip(cx === c)}
          >
            <Text
              style={{
                fontSize: t.fontSize.xs,
                color: cx === c ? t.color.accentText : t.color.ink2,
              }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Your estimate (hours)"
        placeholder="optional, e.g. 4"
        value={hoursText}
        onChangeText={setHoursText}
        keyboardType="numeric"
      />

      {/* Deterministic readout — only when there is a category + complexity to compute from. */}
      {range != null && resolved != null ? (
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {`Baseline ${range.minHours.toFixed(1)}–${range.maxHours.toFixed(1)} h`}
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {`Estimate ${resolved.effectiveHours.toFixed(1)} h (${resolved.provenance})`}
          </Text>
          {vsActual != null && (
            <Text
              style={{
                fontSize: t.fontSize.xs,
                fontWeight: '600',
                color:
                  vsActual.status === 'over'
                    ? t.color.warn
                    : vsActual.status === 'under'
                      ? t.color.good
                      : t.color.ink2,
              }}
            >
              {`Actual ${vsActual.actualHours.toFixed(1)} h — ${
                vsActual.deltaHours >= 0 ? '+' : ''
              }${vsActual.deltaHours.toFixed(1)} h (${vsActual.status})`}
            </Text>
          )}
        </View>
      ) : (
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          Pick a category and complexity for a baseline estimate.
        </Text>
      )}

      <View style={{ flexDirection: 'row' }}>
        <Button
          size="sm"
          disabled={busy}
          onPress={() =>
            onSave({
              category: cat,
              complexity: cx,
              estimateMinutes: userHours != null ? Math.round(userHours * 60) : null,
            })
          }
        >
          Save estimate
        </Button>
      </View>
    </View>
  )
}
