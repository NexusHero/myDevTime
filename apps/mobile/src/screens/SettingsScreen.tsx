import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Card, Row, Switch, SegmentedControl } from '../components/index'
import { useTheme, useThemePref, useAccent, useDensity } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import type { ThemePref } from '../theme/resolveMode'
import type { AccentTheme, Density } from '@mydevtime/design'

/**
 * Settings (ux-vision §3) — the preferences, subscription, and data controls the
 * Profile hub links into. Toggles are local state in this scaffold; the
 * subscription and data-export/delete rows are the entry points the billing (#34)
 * and account (#5) flows will own. Consent and data-ownership items are surfaced
 * explicitly (REQ-025 / GDPR), not buried.
 */
const CHEVRON = '›'

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Text
      style={{
        fontSize: t.fontSize.xs,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: t.color.ink3,
        marginBottom: t.spacing.s2,
      }}
    >
      {children}
    </Text>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const { pref, setPref } = useThemePref()
  const { accent, setAccent } = useAccent()
  const { density, setDensity } = useDensity()

  const [reminders, setReminders] = useState(true)
  const [idleDetection, setIdleDetection] = useState(true)
  const [weekStartMonday, setWeekStartMonday] = useState(true)
  const [meetingConsent, setMeetingConsent] = useState(false)

  const chevron = <Text style={{ color: t.color.ink3, fontSize: t.fontSize.lg }}>{CHEVRON}</Text>

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <SubScreenHeader title="Settings" subtitle="Preferences, plan & your data" onBack={onBack} />

      <View>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <View
            style={{
              padding: t.spacing.s4,
              gap: t.spacing.s3,
              borderBottomWidth: 1,
              borderBottomColor: t.color.border,
            }}
          >
            <Text style={{ fontSize: t.fontSize.sm, fontWeight: '500', color: t.color.ink }}>
              Theme
            </Text>
            <SegmentedControl<ThemePref>
              segments={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              active={pref}
              onChange={setPref}
            />
          </View>
          <View
            style={{
              padding: t.spacing.s4,
              gap: t.spacing.s3,
              borderBottomWidth: 1,
              borderBottomColor: t.color.border,
            }}
          >
            <Text style={{ fontSize: t.fontSize.sm, fontWeight: '500', color: t.color.ink }}>
              Accent Color
            </Text>
            <SegmentedControl<AccentTheme>
              segments={[
                { value: 'blueprint', label: 'Blueprint' },
                { value: 'sovereign', label: 'Sovereign' },
                { value: 'ember', label: 'Ember' },
              ]}
              active={accent}
              onChange={setAccent}
            />
          </View>
          <View style={{ padding: t.spacing.s4, gap: t.spacing.s3 }}>
            <Text style={{ fontSize: t.fontSize.sm, fontWeight: '500', color: t.color.ink }}>
              Density
            </Text>
            <SegmentedControl<Density>
              segments={[
                { value: 'regular', label: 'Regular' },
                { value: 'compact', label: 'Compact' },
              ]}
              active={density}
              onChange={setDensity}
            />
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>Preferences</SectionLabel>
        <Card>
          <Row
            title="Focus reminders"
            subtitle="Nudge when a planned block starts"
            trailing={
              <Switch
                checked={reminders}
                onChange={setReminders}
                accessibilityLabel="Focus reminders"
              />
            }
          />
          <Row
            title="Idle detection"
            subtitle="Ask what to do with away time"
            trailing={
              <Switch
                checked={idleDetection}
                onChange={setIdleDetection}
                accessibilityLabel="Idle detection"
              />
            }
          />
          <Row
            title="Week starts Monday"
            trailing={
              <Switch
                checked={weekStartMonday}
                onChange={setWeekStartMonday}
                accessibilityLabel="Week starts Monday"
              />
            }
          />
        </Card>
      </View>

      <View>
        <SectionLabel>Meetings & AI</SectionLabel>
        <Card>
          <Row
            title="Allow meeting recording"
            subtitle="Opt-in, revocable per meeting (REQ-025)"
            trailing={
              <Switch
                checked={meetingConsent}
                onChange={setMeetingConsent}
                accessibilityLabel="Allow meeting recording"
              />
            }
          />
          <Row
            title="AI credits"
            subtitle="Balance, ledger & packs"
            trailing={chevron}
            onPress={() => undefined}
          />
        </Card>
      </View>

      <View>
        <SectionLabel>Subscription</SectionLabel>
        <Card>
          <Row
            title="Current plan"
            subtitle="Renews Aug 1"
            trailing={<Badge tone="accent">Pro</Badge>}
          />
          <Row
            title="Manage subscription"
            subtitle="Payment method, invoices, cancel"
            trailing={chevron}
            onPress={() => undefined}
          />
        </Card>
      </View>

      <View>
        <SectionLabel>Data & privacy</SectionLabel>
        <Card>
          <Row
            title="Export my data"
            subtitle="Entries, transcripts & reports"
            trailing={chevron}
            onPress={() => undefined}
          />
          <Row
            title="Delete account"
            subtitle="Erases your workspace and data"
            trailing={
              <Text style={{ color: t.color.crit, fontSize: t.fontSize.lg }}>{CHEVRON}</Text>
            }
            onPress={() => undefined}
          />
        </Card>
      </View>

      <Text
        style={{
          fontSize: t.fontSize.xs,
          color: t.color.ink3,
          textAlign: 'center',
          fontFamily: t.fontFamily.numeric,
        }}
      >
        myDevTime · v0.0.0
      </Text>
    </ScrollView>
  )
}
