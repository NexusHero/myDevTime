import { View } from 'react-native'
import { blockStateStyle, type PlannerBlockState } from '@mydevtime/design'
import { Text } from '../core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The redesigned plan block (ADR-0072 D3, REQ-074, issue #341): strict type
 * hierarchy (title > time > meta), the project colour as an **edge** — never a
 * fill — and one of four unmistakable states: `planned / live / done / missed`.
 * All state colours come from the pure, AA-checked `blockStateStyle` in
 * `@mydevtime/design`, so the RN canvas and the web renderers wear the identical
 * language. Presentational and read-only: the state is derived upstream
 * (deterministically, from the clock + observed coverage — ADR-0005); `missed`
 * is exactly the state the one-tap repair (#339) consumes.
 */
export interface PlanBlockViewProps {
  readonly label: string
  /** `HH:MM–HH:MM`, pre-formatted by the caller. */
  readonly timeLabel: string
  readonly state: PlannerBlockState
  /** The project colour (or kind tone) — worn only as the left edge. */
  readonly edgeColor: string
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
  edgeColor,
  top,
  height,
}: PlanBlockViewProps): React.JSX.Element {
  const t = useTheme()
  const s = blockStateStyle(state, t.color)
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
        backgroundColor: s.fill,
        // Colour lives on the edge, state on the frame: missed tears the outline.
        borderWidth: 1,
        borderStyle: s.dashed ? 'dashed' : 'solid',
        borderColor: s.dashed && s.marker !== null ? s.marker : t.color.border,
        borderLeftWidth: 3,
        borderLeftColor: edgeColor,
        opacity: s.dimmed ? 0.8 : 1,
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
