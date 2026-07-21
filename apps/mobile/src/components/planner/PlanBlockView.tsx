import { View } from 'react-native'
import { blockStateStyle, type PlannerBlockState } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The plan block (ADR-0072 D3, REQ-074, issue #341 — owner-revised): strict type
 * hierarchy (title > time > meta), the project colour as the block's **bold fill**
 * ("Farbe knallt, Ruhe kommt aus Layern"), and one of four unmistakable states:
 * `planned / live / done / missed`. State reads *on top of* the fill, never by
 * draining it — planned is the full fill, live adds the orange live pip, done
 * recedes (muted fill, still coloured), missed keeps the fill and gains a dashed
 * tear edge (the handle the one-tap repair, #339, consumes). Fill + luminance-
 * readable ink come from the pure, AA-checked `blockStateStyle` in
 * `@mydevtime/design`, so the RN canvas and the web renderers wear one language.
 * Presentational and read-only: the state is derived upstream (ADR-0005).
 */
export interface PlanBlockViewProps {
  readonly label: string
  /** `HH:MM–HH:MM`, pre-formatted by the caller. */
  readonly timeLabel: string
  readonly state: PlannerBlockState
  /** The project (or kind) colour — worn as the block's bold fill. */
  readonly fillColor: string
  /** Pixel offsets within the day column (compressed mapping is the caller's). */
  readonly top: number
  readonly height: number
}

const STATE_GLYPH: Record<PlannerBlockState, string | null> = {
  planned: null,
  live: '●',
  done: '✓',
  missed: '!',
}

const STATE_LABEL: Record<PlannerBlockState, string> = {
  planned: 'planned',
  live: 'live now',
  done: 'done',
  missed: 'missed',
}

export function PlanBlockView({
  label,
  timeLabel,
  state,
  fillColor,
  top,
  height,
}: PlanBlockViewProps): React.JSX.Element {
  const t = useTheme()
  const s = blockStateStyle(state, fillColor, t.color)
  const px = Math.max(height, 14)
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}, ${timeLabel}, ${STATE_LABEL[state]}`}
      style={{
        position: 'absolute',
        left: 2,
        right: 8,
        top: top + 1,
        height: px,
        borderRadius: t.radius.chip,
        overflow: 'hidden',
        // Colour knallt: the project colour fills the block. State is an addition —
        // a missed block keeps its fill and wears a dashed tear edge (the repair handle).
        backgroundColor: s.fill,
        borderWidth: s.dashed ? 1.5 : 0,
        borderStyle: s.dashed ? 'dashed' : 'solid',
        borderColor: s.edge ?? 'transparent',
        paddingHorizontal: 7,
        justifyContent: 'center',
      }}
    >
      {px >= 22 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {STATE_GLYPH[state] !== null && (
            <Text style={{ fontSize: 9, fontWeight: '800', color: s.marker ?? s.title }}>
              {STATE_GLYPH[state]}
            </Text>
          )}
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: t.fontSize.xs, fontWeight: '700', color: s.title }}
          >
            {label}
          </Text>
        </View>
      )}
      {px >= 38 && (
        <Text
          style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize['2xs'], color: s.time }}
        >
          {timeLabel}
        </Text>
      )}
    </View>
  )
}
