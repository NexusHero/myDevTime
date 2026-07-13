import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '../core/Text'
import { ReanimatedTimer } from '../ReanimatedTimer'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Island (canvas) — the one persistent, glanceable pill carrying live state
 * (running timer + punch status), collapsed by default and expanding to quick
 * actions (ux-vision §2.3). It is a floating **dark** pill in every theme/mode
 * (it never sits over other content), so its surface is fixed dark, not
 * theme-flipped. Ported from the design system's `Island`.
 */
export interface IslandAction {
  readonly label: string
  readonly onPress?: () => void
}

interface IslandProps {
  readonly running?: boolean
  readonly elapsed?: string
  /**
   * When running, the session start (ISO) + banked ms let the pill tick on the UI
   * thread via `ReanimatedTimer` instead of re-rendering every second. Omitted →
   * the static `elapsed` snapshot is shown (idle/paused).
   */
  readonly startedAt?: string
  readonly accumulatedMs?: number
  readonly punched?: boolean
  readonly expanded?: boolean
  readonly onToggle?: () => void
  readonly actions?: readonly IslandAction[]
  /**
   * `floating` (default) is the free bottom-center phone pill; `docked` is the
   * full-width desktop sidebar-footer slot that never overlaps the working surface
   * and glows live-orange while running (design v2).
   */
  readonly posture?: 'floating' | 'docked'
}

const ISLAND_BG = '#12151c'

/**
 * The live signal dot — orange while running (never the accent, ux-vision §4),
 * wrapped in a soft live ring. While running it emits a slow expanding pulse
 * (design v4 motion pass), gated behind the OS reduced-motion setting: when the
 * user opts out (or the timer is idle) it renders as a plain static dot.
 */
function LiveDot({
  running,
  live,
  liveSoft,
  ink3,
}: {
  readonly running: boolean
  readonly live: string
  readonly liveSoft: string
  readonly ink3: string
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const pulse = useSharedValue(0)
  const animate = running && !reduce

  useEffect(() => {
    pulse.value = animate
      ? withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, false)
      : 0
  }, [animate, pulse])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.9 }],
    opacity: 0.5 * (1 - pulse.value),
  }))

  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: running ? liveSoft : 'transparent',
      }}
    >
      {animate && (
        <Animated.View
          style={[
            { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: live },
            ringStyle,
          ]}
        />
      )}
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: running ? live : ink3 }}
      />
    </View>
  )
}

export function Island({
  running = true,
  elapsed = '00:00:00',
  startedAt,
  accumulatedMs = 0,
  punched = true,
  expanded = false,
  onToggle,
  actions = [],
  posture = 'floating',
}: IslandProps): React.JSX.Element {
  const t = useTheme()
  const docked = posture === 'docked'
  const dockedGlow = docked && running
  return (
    <Pressable
      onPress={() => onToggle?.()}
      accessibilityRole="button"
      accessibilityLabel={`Timer ${elapsed}, ${punched ? 'punched in' : 'punched out'}`}
      style={{
        alignSelf: docked ? 'stretch' : 'flex-start',
        ...(docked ? { width: '100%' } : null),
        backgroundColor: ISLAND_BG,
        borderRadius: docked ? t.radius.card : expanded ? t.radius.card : t.radius.pill,
        paddingVertical: docked || expanded ? t.spacing.s3 : 10,
        paddingHorizontal: docked || expanded ? t.spacing.s3 : t.spacing.s4,
        gap: docked || expanded ? t.spacing.s3 : 0,
        // Docked glows live-orange while running (the "happening now" signal, ux-vision §4);
        // the floating pill and idle docked keep a neutral drop shadow.
        shadowColor: dockedGlow ? t.color.live : '#000000',
        shadowOffset: { width: 0, height: dockedGlow ? 8 : 6 },
        shadowOpacity: dockedGlow ? 0.45 : 0.22,
        shadowRadius: dockedGlow ? 16 : 12,
        elevation: dockedGlow ? 8 : 4,
        ...(!docked && expanded ? { minWidth: 220 } : null),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <LiveDot
          running={running}
          live={t.color.live}
          liveSoft={t.color.liveSoft}
          ink3={t.color.ink3}
        />
        {running && startedAt ? (
          <ReanimatedTimer
            startedAt={startedAt}
            accumulatedMs={accumulatedMs}
            style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.sm, color: '#ffffff' }}
          />
        ) : (
          <Text
            style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.sm, color: '#ffffff' }}
          >
            {elapsed}
          </Text>
        )}
        <Text style={{ fontSize: t.fontSize.xs, color: 'rgba(255,255,255,0.55)' }}>
          {punched ? 'Punched in' : 'Punched out'}
        </Text>
      </View>
      {expanded && actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              onPress={() => a.onPress?.()}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={{
                flex: 1,
                paddingVertical: t.spacing.s2,
                borderRadius: t.radius.pill,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: t.fontSize.xs, fontWeight: '600' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  )
}
