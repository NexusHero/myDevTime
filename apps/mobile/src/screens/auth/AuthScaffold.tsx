import { useEffect, useState } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { Text } from '../../components/core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The shared frame for the Login/Register screens (design v8 auth): a dark brand
 * panel on the left (wordmark, one-line pitch, a live-orange "now" clock — the
 * product's stamp motif) and the form on the right; on a phone the brand collapses
 * to a compact header above the form. The panel is intentionally always-dark (a
 * brand surface, like the splash), so it uses fixed brand colors rather than the
 * mode-flipping theme tokens; `--live` orange stays the theme-independent token.
 */
const NAVY = '#0d1330'
const ON_NAVY = '#f4f6ff'

function LiveClock({ color }: { color: string }): React.JSX.Element {
  const t = useTheme()
  const [now, setNow] = useState('')
  useEffect(() => {
    const tick = (): void => {
      const d = new Date()
      const p = (n: number): string => String(n).padStart(2, '0')
      setNow(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: t.radius.pill,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize.sm, color: ON_NAVY }}>
        {now}
      </Text>
    </View>
  )
}

/** The dark brand block — full panel on desktop, compact header on phone. */
function Brand({ compact, pitch }: { compact: boolean; pitch: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View
      style={{
        backgroundColor: NAVY,
        overflow: 'hidden',
        justifyContent: compact ? 'flex-start' : 'space-between',
        padding: compact ? t.spacing.s5 : t.spacing.s7,
        gap: t.spacing.s4,
        ...(compact ? {} : { flex: 1, alignSelf: 'stretch' }),
      }}
    >
      {/* the warm "now" glow */}
      <View
        style={{
          position: 'absolute',
          width: 460,
          height: 460,
          borderRadius: 230,
          right: -160,
          bottom: -200,
          backgroundColor: t.color.live,
          opacity: 0.16,
        }}
        accessibilityElementsHidden
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* the orange playhead motif */}
        <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: t.color.live }} />
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontSize: t.fontSize.lg,
            fontWeight: '700',
            color: ON_NAVY,
          }}
        >
          myDevTime
        </Text>
      </View>
      {!compact && (
        <Text
          style={{
            fontFamily: t.fontFamily.display,
            fontSize: t.fontSize.xl,
            fontWeight: '700',
            color: ON_NAVY,
            lineHeight: t.fontSize.xl * 1.25,
          }}
        >
          {pitch}
        </Text>
      )}
      {!compact && <LiveClock color={t.color.live} />}
    </View>
  )
}

export function AuthScaffold({
  pitch,
  children,
}: {
  readonly pitch: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 900

  const form = (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing.s5 }}
    >
      <View style={{ alignSelf: 'center', width: '100%', maxWidth: 400, gap: t.spacing.s4 }}>
        {children}
      </View>
    </ScrollView>
  )

  if (!wide) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg }}>
        <Brand compact pitch={pitch} />
        {form}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.color.bg }}>
      <Brand compact={false} pitch={pitch} />
      <View style={{ flex: 1 }}>{form}</View>
    </View>
  )
}
