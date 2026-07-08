import { Pressable, Text, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider.js'

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
}

const ISLAND_BG = '#12151c'

export function Island({
  running = true,
  elapsed = '00:00:00',
  punched = true,
  expanded = false,
  onToggle,
  actions = [],
}: IslandProps): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => onToggle?.()}
      accessibilityRole="button"
      accessibilityLabel={`Timer ${elapsed}, ${punched ? 'punched in' : 'punched out'}`}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: ISLAND_BG,
        borderRadius: expanded ? t.radius.card : t.radius.pill,
        paddingVertical: expanded ? t.spacing.s3 : 10,
        paddingHorizontal: expanded ? t.spacing.s3 : t.spacing.s4,
        gap: expanded ? t.spacing.s3 : 0,
        ...(expanded ? { minWidth: 220 } : null),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: running ? t.color.accent : t.color.ink3,
          }}
        />
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
