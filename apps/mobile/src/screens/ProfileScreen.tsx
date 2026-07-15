import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { Text } from '../components/core/Text'
import {
  PROFILE_HUB_LINKS,
  formatDuration,
  formatSigned,
  palettes,
  type AccentTheme,
  type ProfileHubLink,
  type Screen,
} from '@mydevtime/design'
import { useAccent, useTheme, useThemePref } from '../theme/ThemeProvider'
import type { ThemePref } from '../theme/resolveMode'
import { Badge, Button, Card, LeaveBalance, Row, ScreenScaffold, Switch } from '../components/index'
import { useConnectors } from '../hooks/useConnectors'
import { useCredits } from '../hooks/useCredits'
import { useWorktime } from '../hooks/useWorktime'
import { useAbsences } from '../hooks/useAbsences'
import { initialsOf, useSessionContext } from '../shell/SessionContext'
import { confirmDestructive } from '../utils/confirmDestructive'

/**
 * Profile & settings — the personal hub (ux-vision §3), ported 1:1 from the
 * design system's `ProfileScreen`: a two-column responsive layout (two columns on
 * wide, stacked on phone). Left: identity, the **Appearance** controls
 * (accent theme + light/dark mode, wired to the live `ThemeProvider`), the
 * work-time summary and the settings toggles. Right: **Integrations**, the
 * AI-credit balance + ledger preview (#34) and the absences summary (#37). Every
 * number renders through the shared `format*` helpers; the AI never mutates state
 * (ADR-0005). The identity and Sign-out seam read the shared session (REQ-002).
 */
/** Row copy for the surfaces the Profile hub links into (ux-vision §3). */
const HUB_META: Record<ProfileHubLink, { title: string; subtitle: string }> = {
  meetings: { title: 'Meetings', subtitle: 'Transcripts & AI insights' },
  assistant: { title: 'Assistant', subtitle: 'Ask about your time · read-only' },
}

const DAILY_TARGET_MS = 8 * 3_600_000
const WEEKLY_TARGET_MS = 40 * 3_600_000
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** A short `d. Mon` label from a credit entry's ISO instant (no locale drift). */
const MONTH_SHORT = [
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
]
function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${String(Number(d))}. ${MONTH_SHORT[Number(m) - 1] ?? ''}`
}

/** Appearance controls, wired to the live ThemeProvider. */
const ACCENT_OPTIONS: readonly { readonly key: AccentTheme; readonly label: string }[] = [
  { key: 'blueprint', label: 'Blueprint' },
  { key: 'sovereign', label: 'Sovereign' },
  { key: 'ember', label: 'Ember' },
]
const MODE_OPTIONS: readonly { readonly key: ThemePref; readonly label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

/** The small uppercase sub-heading used inside the Appearance card. */
function MicroLabel({ children }: { children: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Text
      style={{
        fontSize: t.fontSize['2xs'],
        fontWeight: '700',
        color: t.color.ink2,
        textTransform: 'uppercase',
        letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
        marginBottom: t.spacing.s2,
      }}
    >
      {children}
    </Text>
  )
}

/** A selectable option button (accent swatch / mode) — selected reads as accent. */
function OptionButton({
  label,
  selected,
  onPress,
  swatch,
}: {
  readonly label: string
  readonly selected: boolean
  readonly onPress: () => void
  readonly swatch?: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: t.radius.card,
        borderWidth: 1.5,
        borderColor: selected ? t.color.accent : t.color.border,
        backgroundColor: selected ? t.color.accentSoft : t.color.surface,
      }}
    >
      {swatch !== undefined && (
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: swatch }} />
      )}
      <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** A label/value line inside the work-time summary. */
function MetaRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{label}</Text>
      {children}
    </View>
  )
}

export function ProfileScreen({
  onNavigate,
}: {
  onNavigate: (screen: Screen) => void
}): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const session = useSessionContext()
  const { accent, setAccent } = useAccent()
  const { pref, setPref } = useThemePref()

  const [reminders, setReminders] = useState(true)
  const [calendarCapture, setCalendarCapture] = useState(true)
  const [autoTracker, setAutoTracker] = useState(true)
  const connectors = useConnectors()
  const credits = useCredits()
  const wt = useWorktime()
  const absences = useAbsences()

  const creditBalance = credits.data?.balance ?? 0
  const ledger = (credits.data?.ledger ?? []).slice(0, 3)
  const overtimeMs = wt.overtimeMs
  const vacation = absences.data?.balance ?? {
    allowanceDays: 0,
    carryOverDays: 0,
    usedDays: 0,
    remainingDays: 0,
  }

  const user = session.user ?? { name: '', email: '', id: '', emailVerified: false }
  const displayName = user.name.trim() || user.email || 'You'
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }
  const chevron = <Text style={{ color: t.color.ink3, fontSize: t.fontSize.lg }}>›</Text>

  const identity = (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s4 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: t.color.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
        >
          <Text
            style={{
              fontSize: t.fontSize.md,
              fontWeight: '700',
              color: t.color.accentText,
              fontFamily: t.fontFamily.display,
            }}
          >
            {initialsOf(user)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: t.fontSize.md,
              fontWeight: '700',
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
            }}
          >
            {displayName}
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
            {user.email || 'NexusHero workspace'}
          </Text>
        </View>
        <Badge tone="accent">Pro</Badge>
      </View>
    </Card>
  )

  const darstellung = (
    <Card title="Appearance">
      <View style={{ gap: t.spacing.s4 }}>
        <View>
          <MicroLabel>Accent</MicroLabel>
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            {ACCENT_OPTIONS.map(o => (
              <OptionButton
                key={o.key}
                label={o.label}
                selected={accent === o.key}
                onPress={() => setAccent(o.key)}
                swatch={palettes[o.key][t.mode].accent}
              />
            ))}
          </View>
        </View>
        <View>
          <MicroLabel>Mode</MicroLabel>
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            {MODE_OPTIONS.map(o => (
              <OptionButton
                key={o.key}
                label={o.label}
                selected={pref === o.key}
                onPress={() => setPref(o.key)}
              />
            ))}
          </View>
        </View>
      </View>
    </Card>
  )

  const arbeitszeit = (
    <Card title="Work time" subtitle="REQ-028 · ArbZG §4">
      <View style={{ gap: t.spacing.s4 }}>
        <MetaRow label="Target per day">
          <Text style={{ ...mono, fontSize: t.fontSize.sm, fontWeight: '600' }}>
            {formatDuration(DAILY_TARGET_MS)} h
          </Text>
        </MetaRow>
        <MetaRow label="Weekly target">
          <Text style={{ ...mono, fontSize: t.fontSize.sm, fontWeight: '600' }}>
            {formatDuration(WEEKLY_TARGET_MS)} h
          </Text>
        </MetaRow>
        <MetaRow label="Week model">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {WEEK_DAYS.map((d, i) => {
              const workday = i < 5
              return (
                <View
                  key={d}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: workday ? t.color.accentSoft : t.color.sunk,
                  }}
                >
                  <Text
                    style={{
                      fontSize: t.fontSize['2xs'],
                      fontWeight: '700',
                      color: workday ? t.color.accentText : t.color.ink3,
                    }}
                  >
                    {d}
                  </Text>
                </View>
              )
            })}
          </View>
        </MetaRow>
        <MetaRow label="Overtime balance">
          <Text
            style={{
              ...mono,
              fontSize: t.fontSize.md,
              fontWeight: '700',
              color: overtimeMs >= 0 ? t.color.good : t.color.warn,
            }}
          >
            {overtimeMs >= 0 ? '+' : '−'}
            {formatDuration(Math.abs(overtimeMs))} h
          </Text>
        </MetaRow>
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          Break warnings follow the ArbZG §4 preset — guidance, not legal advice.
        </Text>
        <Row
          title="Open work time"
          subtitle="Clock-in/out, breaks & overtime"
          trailing={chevron}
          onPress={() => onNavigate('worktime')}
        />
      </View>
    </Card>
  )

  const einstellungen = (
    <Card title="Settings">
      <Row
        title="Break reminders (ArbZG)"
        trailing={
          <Switch
            checked={reminders}
            onChange={setReminders}
            accessibilityLabel="Break reminders (ArbZG)"
          />
        }
      />
      <Row
        title="Calendar auto-capture"
        trailing={
          <Switch
            checked={calendarCapture}
            onChange={setCalendarCapture}
            accessibilityLabel="Calendar auto-capture"
          />
        }
      />
      <Row
        title="Auto-Tracker (record app usage)"
        trailing={
          <Switch
            checked={autoTracker}
            onChange={setAutoTracker}
            accessibilityLabel="Auto-Tracker (record app usage)"
          />
        }
      />
      <Row
        title="Hourly rates"
        subtitle="€/hr per workspace, client & project"
        trailing={chevron}
        onPress={() => onNavigate('rates')}
      />
      <Row
        title="All settings"
        subtitle="Preferences, subscription, data & privacy"
        trailing={chevron}
        onPress={() => onNavigate('settings')}
      />
    </Card>
  )

  const integrationen = (
    <Card
      title="Integrations"
      subtitle="OAuth · export only after confirmation — never automatic"
      action={connectors.live ? undefined : <Badge tone="neutral">Preview</Badge>}
    >
      {connectors.connectors.map(item => {
        // Honest state (M3): connected (sealed token) → good; configured but not yet
        // connected → "Connect"; not configured in this deployment → "Planned".
        const tone: 'good' | 'accent' | 'neutral' = item.connected
          ? 'good'
          : item.configured
            ? 'accent'
            : 'neutral'
        const label = item.connected ? 'Connected' : item.configured ? 'Connect' : 'Planned'
        return (
          <Row
            key={item.id}
            title={item.label}
            subtitle={
              item.connected
                ? 'Connected · tap to disconnect'
                : item.configured
                  ? 'Ready to connect (OAuth)'
                  : 'Not yet configured for this instance'
            }
            leading={
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: t.color.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: t.fontSize.xs,
                    fontWeight: '700',
                    color: t.color.surface,
                    fontFamily: t.fontFamily.display,
                  }}
                >
                  {item.label[0]}
                </Text>
              </View>
            }
            trailing={<Badge tone={tone}>{label}</Badge>}
            {...(item.connected
              ? {
                  onPress: () =>
                    confirmDestructive({
                      title: 'Disconnect integration?',
                      message: `Disconnect ${item.label}? You can reconnect anytime via OAuth.`,
                      confirmLabel: 'Disconnect',
                      onConfirm: () => connectors.disconnect(item.id),
                    }),
                }
              : {})}
          />
        )
      })}
    </Card>
  )

  const aiCredits = (
    <Card
      title="AI-Credits"
      action={
        <Button size="sm" variant="secondary" onPress={() => onNavigate('credits')}>
          Top up
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
        <Text style={{ ...mono, fontSize: t.fontSize.xl, fontWeight: '700' }}>
          {String(creditBalance)}
        </Text>
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>Credits left</Text>
      </View>
      <View
        style={{
          marginTop: t.spacing.s3,
          paddingTop: t.spacing.s3,
          borderTopWidth: 1,
          borderTopColor: t.color.border,
        }}
      >
        {ledger.length === 0 ? (
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink3 }}>No entries yet.</Text>
        ) : (
          ledger.map(entry => (
            <Row
              key={entry.id}
              title={entry.reason ?? entry.category}
              subtitle={shortDate(entry.at)}
              trailing={
                <Text
                  style={{
                    fontFamily: t.fontFamily.numeric,
                    fontSize: t.fontSize.sm,
                    color: entry.amount < 0 ? t.color.ink2 : t.color.good,
                  }}
                >
                  {formatSigned(entry.amount)}
                </Text>
              }
            />
          ))
        )}
        <Row title="View ledger & usage" trailing={chevron} onPress={() => onNavigate('credits')} />
      </View>
    </Card>
  )

  const abwesenheiten = (
    <Card title="Absences">
      <LeaveBalance
        entitlement={vacation.allowanceDays}
        taken={vacation.usedDays}
        carryover={vacation.carryOverDays}
      />
      <View style={{ marginTop: t.spacing.s3 }}>
        <Row
          title="Open absence calendar"
          subtitle="Vacation, sickness, holidays"
          trailing={chevron}
          onPress={() => onNavigate('absences')}
        />
      </View>
    </Card>
  )

  return (
    <ScreenScaffold
      header={
        <Text
          style={{
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
            letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
          }}
        >
          Profile & settings
        </Text>
      }
    >
      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          gap: t.spacing.s4,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ alignSelf: 'stretch', gap: t.spacing.s4, ...(wide ? { flex: 1 } : null) }}>
          {identity}
          {darstellung}
          {arbeitszeit}
          {einstellungen}
        </View>
        <View style={{ alignSelf: 'stretch', gap: t.spacing.s4, ...(wide ? { flex: 1 } : null) }}>
          {integrationen}
          {aiCredits}
          {abwesenheiten}
        </View>
      </View>

      {/* More — the top-level surfaces kept off the phone's five-tab bar (ux-vision §3). */}
      <Card title="More">
        {PROFILE_HUB_LINKS.map(link => (
          <Row
            key={link}
            title={HUB_META[link].title}
            subtitle={HUB_META[link].subtitle}
            trailing={chevron}
            onPress={() => onNavigate(link)}
          />
        ))}
      </Card>

      {/* Sign out — ends the session; in demo mode it returns to the login gate. */}
      <Card>
        <Row
          title="Sign out"
          subtitle={session.live ? user.email : 'Demo session'}
          trailing={
            <Text style={{ color: t.color.crit, fontSize: t.fontSize.sm, fontWeight: '600' }}>
              {session.busy ? '…' : 'Sign out'}
            </Text>
          }
          onPress={() => {
            void session.signOut()
          }}
        />
      </Card>
    </ScreenScaffold>
  )
}
