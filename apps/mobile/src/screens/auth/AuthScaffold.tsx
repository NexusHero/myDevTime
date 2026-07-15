import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Text } from '../../components/core/Text'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The shared frame for the Login/Register screens (design v8 auth): a dark brand
 * panel on the left (wordmark with the orange playhead motif, a one-line pitch, and
 * a decorative "Day Canvas" — settled blocks, a live block with a real ticking clock,
 * a now-line and one ghost AI-suggestion) and the form on the right; on a phone the
 * brand collapses to a compact header above the form.
 *
 * The panel is intentionally always-dark (a brand surface, like the splash), so it
 * uses fixed brand colors rather than the mode-flipping theme tokens; `t.color.live`
 * orange stays the theme-independent "now" token, reused for the playhead, the
 * headline emphasis, the live block and the now-line. The Day Canvas is DECORATION
 * only (no real data) — the form beside it stays wired to the real auth seam.
 */

// Brand-surface hex (documented exception — see scripts/design-adherence-baseline.json):
// the navy radial-gradient stops and the on-navy ink are always-dark, so they are
// fixed rather than theme tokens. Everything else here uses rgba() washes or tokens.
const NAVY_STOPS = ['#1e3fae', '#16255c', '#0d1330', '#0a0c11'] as const
const ON_NAVY = '#f4f6ff'
const ON_NAVY_2 = 'rgba(255,255,255,0.62)' // secondary ink on navy
const ON_NAVY_3 = 'rgba(255,255,255,0.42)' // tertiary ink on navy (labels, footer)

/** A real wall-clock ticking `HH:MM:SS`, reused by the live canvas block. */
function useClock(): string {
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
  return now
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Today as a short decorative caption, e.g. "Wed · Jul 15". */
function todayCaption(): string {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${String(d.getDate())}`
}

/**
 * The navy radial-gradient backdrop plus two soft glow orbs (warm orange bottom-right,
 * blue top-left), drawn as one absolute-fill SVG behind the panel content.
 */
function BrandBackdrop(): React.JSX.Element {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient id="navy" cx="0.15" cy="0" rx="1.3" ry="1.1" fx="0.15" fy="0">
          <Stop offset="0" stopColor={NAVY_STOPS[0]} />
          <Stop offset="0.42" stopColor={NAVY_STOPS[1]} />
          <Stop offset="0.78" stopColor={NAVY_STOPS[2]} />
          <Stop offset="1" stopColor={NAVY_STOPS[3]} />
        </RadialGradient>
        <RadialGradient id="glowWarm" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="rgba(255,83,32,0.22)" />
          <Stop offset="0.62" stopColor="rgba(255,83,32,0)" />
        </RadialGradient>
        <RadialGradient id="glowBlue" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="rgba(94,133,255,0.25)" />
          <Stop offset="0.65" stopColor="rgba(94,133,255,0)" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#navy)" />
      <Ellipse cx="98" cy="104" rx="52" ry="46" fill="url(#glowWarm)" />
      <Ellipse cx="6" cy="-2" rx="40" ry="40" fill="url(#glowBlue)" />
    </Svg>
  )
}

/** One settled time block in the decorative canvas. */
function CanvasBlock({
  hour,
  title,
  duration,
  fill,
}: {
  readonly hour: string
  readonly title: string
  readonly duration: string
  readonly fill: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
      <Text
        style={{
          width: 36,
          textAlign: 'right',
          fontFamily: t.fontFamily.numeric,
          fontSize: t.fontSize['2xs'],
          color: ON_NAVY_3,
        }}
      >
        {hour}
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          minHeight: 40,
          paddingVertical: t.spacing.s2,
          paddingHorizontal: t.spacing.s3,
          borderRadius: t.radius.block,
          backgroundColor: fill,
        }}
      >
        <Text
          style={{ flex: 1, fontSize: t.fontSize.xs, color: ON_NAVY, fontWeight: '600' }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{ fontFamily: t.fontFamily.numeric, fontSize: t.fontSize['2xs'], color: ON_NAVY }}
        >
          {duration}
        </Text>
      </View>
    </View>
  )
}

/** The decorative mini Day Canvas — settled blocks, a live block, a now-line, a ghost row. */
function DayCanvas(): React.JSX.Element {
  const t = useTheme()
  const clock = useClock()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flex: 1,
        minHeight: 0,
        maxWidth: 470,
        borderRadius: t.radius.xl,
        borderWidth: t.borderWidth.hair,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.045)',
        padding: t.spacing.s4,
        gap: t.spacing.s2,
      }}
    >
      {/* caption */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: t.spacing.s1,
        }}
      >
        <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: ON_NAVY }}>Today</Text>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: ON_NAVY_3,
          }}
        >
          {todayCaption()}
        </Text>
      </View>

      <CanvasBlock hour="09:00" title="Focus block" duration="2:10" fill="rgba(59,108,240,0.92)" />
      <CanvasBlock hour="11:10" title="Code review" duration="0:40" fill="rgba(20,157,113,0.90)" />

      {/* break block */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text
          style={{
            width: 36,
            textAlign: 'right',
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: ON_NAVY_3,
          }}
        >
          12:00
        </Text>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 30,
            paddingVertical: t.spacing.s1,
            paddingHorizontal: t.spacing.s3,
            borderRadius: t.radius.block,
            borderWidth: t.borderWidth.hair,
            borderColor: 'rgba(255,255,255,0.22)',
            borderStyle: 'dashed',
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <Text
            style={{ flex: 1, fontSize: t.fontSize['2xs'], fontWeight: '600', color: ON_NAVY_2 }}
          >
            Lunch break
          </Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize['2xs'],
              color: ON_NAVY_2,
            }}
          >
            0:45
          </Text>
        </View>
      </View>

      {/* live block — the running "now", with a real ticking clock */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text
          style={{
            width: 36,
            textAlign: 'right',
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: ON_NAVY_3,
          }}
        >
          12:45
        </Text>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            minHeight: 52,
            paddingVertical: t.spacing.s2,
            paddingHorizontal: t.spacing.s3,
            borderRadius: t.radius.block,
            backgroundColor: t.color.live,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ON_NAVY }} />
          <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: ON_NAVY, fontWeight: '600' }}>
            Deep work
          </Text>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.md,
              fontWeight: '700',
              color: ON_NAVY,
            }}
          >
            {clock}
          </Text>
        </View>
      </View>

      {/* now-line */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, marginTop: 2 }}>
        <View style={{ width: 36 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color.live }} />
          <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: t.color.live }} />
        </View>
      </View>

      {/* ghost AI-suggestion row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          marginTop: t.spacing.s1,
          paddingVertical: t.spacing.s2,
          paddingHorizontal: t.spacing.s3,
          borderRadius: t.radius.block,
          borderWidth: t.borderWidth.medium,
          borderColor: 'rgba(255,255,255,0.30)',
          borderStyle: 'dashed',
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: t.radius.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.color.aiInk,
          }}
        >
          <Text style={{ fontSize: t.fontSize['2xs'], color: ON_NAVY }}>✦</Text>
        </View>
        <Text style={{ flex: 1, fontSize: t.fontSize['2xs'], color: ON_NAVY_2 }} numberOfLines={2}>
          Suggestion: fill the 15:30 gap — accept?
        </Text>
      </View>
    </View>
  )
}

/** The wordmark lockup: the orange playhead motif + the product name. */
function Wordmark(): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
  )
}

/** The pitch: a headline with an orange "live." emphasis + a supporting subline. */
function Pitch({ subline }: { readonly subline: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text
        style={{
          fontFamily: t.fontFamily.display,
          fontSize: t.fontSize.xl,
          fontWeight: '700',
          color: ON_NAVY,
          lineHeight: t.fontSize.xl * 1.1,
        }}
      >
        Your day, <Text style={{ color: t.color.live }}>live.</Text>
      </Text>
      <Text
        style={{
          fontSize: t.fontSize.sm,
          color: ON_NAVY_2,
          lineHeight: t.fontSize.sm * 1.55,
          maxWidth: 420,
        }}
      >
        {subline}
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
        overflow: 'hidden',
        justifyContent: compact ? 'flex-start' : 'space-between',
        padding: compact ? t.spacing.s5 : t.spacing.s7,
        gap: compact ? t.spacing.s4 : t.spacing.s6,
        ...(compact ? {} : { flex: 1, alignSelf: 'stretch' }),
      }}
    >
      <BrandBackdrop />
      <Wordmark />
      <Pitch subline={pitch} />
      {!compact && <DayCanvas />}
      {!compact && (
        <Text style={{ fontSize: t.fontSize['2xs'], color: ON_NAVY_3 }}>© 2026 Suhay Sevinc</Text>
      )}
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
