import { Pressable, View } from 'react-native'
import { Text } from '../core/Text'
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

export function Island({
  running = true,
  elapsed = '00:00:00',
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
        {/* The running signal is always live orange (never the accent, ux-vision §4),
            wrapped in a soft live ring while running. */}
        <View
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: running ? t.color.liveSoft : 'transparent',
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: running ? t.color.live : t.color.ink3,
            }}
          />
        </View>
        <Text
          style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.sm, color: '#ffffff' }}
        >
          {elapsed}
        </Text>
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
