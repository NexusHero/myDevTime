import { useState } from 'react'
import { Pressable, View } from 'react-native'
import type { PlannerLayer } from '../../planner/layer'
import { Text } from '../core/Text'
import { Switch } from '../forms/Switch'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The Planner **"View" popover** (design v20 Reduktions-Pass). The calendar is the stage, so the
 * header stays quiet: the secondary controls — the **layer filter** (Work / Life / Both) and the
 * **Reality trace** toggle — no longer sit inline in the header; they live behind one "View" button
 * that wears a dot when a non-default filter or Reality is active. Presentational only: it owns just
 * its open/closed state and reports changes up; the Planner keeps the real layer/reality state and
 * decides (e.g. Reality needs the Auto-Tracker on). Invents nothing (ADR-0005).
 */
export interface PlannerViewMenuProps {
  readonly layer: PlannerLayer
  readonly onLayer: (layer: PlannerLayer) => void
  readonly realityOn: boolean
  readonly onReality: (next: boolean) => void
}

const LAYERS: readonly { readonly value: PlannerLayer; readonly label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'life', label: 'Life' },
  { value: 'both', label: 'Both' },
]

export function PlannerViewMenu({
  layer,
  onLayer,
  realityOn,
  onReality,
}: PlannerViewMenuProps): React.JSX.Element {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const active = layer !== 'both' || realityOn

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityLabel="View options — layers and reality trace"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: active ? t.color.sunk : t.color.surface,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing.s3,
          paddingVertical: t.spacing.s2,
        }}
      >
        <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '700', color: t.color.ink2 }}>
          View
        </Text>
        {active && (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.color.accent }} />
        )}
      </Pressable>

      {open && (
        <>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityLabel="Close view options"
            style={{ position: 'absolute', top: -1000, left: -1000, width: 3000, height: 3000 }}
          />
          <View
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 6,
              width: 250,
              zIndex: 41,
              backgroundColor: t.color.surface,
              borderWidth: 1,
              borderColor: t.color.borderStrong,
              borderRadius: t.radius.card,
              padding: t.spacing.s3,
              elevation: 12,
            }}
          >
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                fontWeight: '800',
                letterSpacing: 0.6,
                color: t.color.ink3,
                marginBottom: t.spacing.s2,
              }}
            >
              LAYERS
            </Text>
            <View
              style={{
                flexDirection: 'row',
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.pill,
                padding: 2,
                marginBottom: t.spacing.s3,
                alignSelf: 'flex-start',
              }}
            >
              {LAYERS.map(l => {
                const on = layer === l.value
                const bg = on ? (l.value === 'life' ? t.color.life : t.color.ink) : 'transparent'
                return (
                  <Pressable
                    key={l.value}
                    onPress={() => onLayer(l.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Layer: ${l.label}`}
                    style={{
                      borderRadius: t.radius.pill,
                      paddingHorizontal: t.spacing.s3,
                      paddingVertical: 4,
                      backgroundColor: bg,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: t.fontSize['2xs'],
                        fontWeight: '700',
                        color: on ? t.color.accentInk : t.color.ink3,
                      }}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink }}>
                  ● Reality trace
                </Text>
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                  Auto-tracker beside the plan
                </Text>
              </View>
              <Switch checked={realityOn} onChange={onReality} accessibilityLabel="Reality trace" />
            </View>
          </View>
        </>
      )}
    </View>
  )
}
