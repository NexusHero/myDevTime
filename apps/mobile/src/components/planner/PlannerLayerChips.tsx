import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The calm canvas's **layer chips** (ADR-0072 D3, REQ-074, ux-vision §2.7): the
 * week shows only the accepted plan + the now-line by default; every additional
 * layer — reality trace, proposal ghosts, life shades, the capacity head-trace,
 * and (at integration, #340) the backlog rail — sits one explicit tap away behind
 * a chip, never all loud at once. Presentational only: the Planner owns the state
 * (persisted per user via the preferences contract) and passes each chip's
 * `active` + `onToggle`; additional surfaces claim a chip by appending to the
 * `chips` array — the row itself never invents a layer.
 */
export interface LayerChip {
  readonly key: string
  readonly label: string
  /** A tiny lead glyph (e.g. `●` for reality, `◇` for ghosts); optional. */
  readonly glyph?: string
  readonly active: boolean
  readonly onToggle: () => void
}

export function PlannerLayerChips({
  chips,
}: {
  readonly chips: readonly LayerChip[]
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Canvas layers"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.s2 }}
    >
      <Text
        style={{
          fontSize: t.fontSize['2xs'],
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: t.color.ink3,
          marginRight: t.spacing.s1,
        }}
      >
        Layers
      </Text>
      {chips.map(chip => (
        <Pressable
          key={chip.key}
          onPress={chip.onToggle}
          accessibilityRole="button"
          accessibilityState={{ selected: chip.active }}
          accessibilityLabel={`${chip.label} layer`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingVertical: 4,
            paddingHorizontal: t.spacing.s3,
            borderRadius: t.radius.pill,
            borderWidth: 1,
            borderColor: chip.active ? t.color.accent : t.color.border,
            backgroundColor: chip.active ? t.color.accentSoft : t.color.surface,
          }}
        >
          {chip.glyph !== undefined && (
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                color: chip.active ? t.color.accentText : t.color.ink3,
              }}
            >
              {chip.glyph}
            </Text>
          )}
          <Text
            style={{
              fontSize: t.fontSize['2xs'],
              fontWeight: '700',
              color: chip.active ? t.color.accentText : t.color.ink2,
            }}
          >
            {chip.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
