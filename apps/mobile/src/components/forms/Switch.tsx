import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Switch (form) — a pill toggle matching the design system's `Switch`
 * (transitions color and thumb position in 140ms, never bounces — ux-vision §4).
 * Touch target: 44pt height (regular) or 32pt (compact density).
 * Colors: accent when on, overlay when off.
 */
interface SwitchProps {
  readonly checked: boolean
  readonly onChange?: (next: boolean) => void
  /** Visible trailing text. Omit when a sibling (e.g. a Row title) already names it. */
  readonly label?: string
  /** Screen-reader label when there is no visible `label` (falls back to `label`). */
  readonly accessibilityLabel?: string
}

export function Switch({
  checked,
  onChange,
  label,
  accessibilityLabel,
}: SwitchProps): React.JSX.Element {
  const t = useTheme()
  const trackHeight = t.touchTarget
  const trackWidth = Math.round(trackHeight * 1.8) // ~80pt for 44pt height
  const thumbSize = trackHeight - 4

  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel ?? label ?? 'toggle'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}
    >
      <View
        style={{
          width: trackWidth,
          height: trackHeight,
          borderRadius: t.radius.pill,
          backgroundColor: checked ? t.color.accent : t.color.overlay,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: checked ? trackWidth - thumbSize - 2 : 2,
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: '#ffffff',
          }}
        />
      </View>
      {label !== undefined && (
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{label}</Text>
      )}
    </Pressable>
  )
}
