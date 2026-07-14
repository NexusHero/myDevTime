import { View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Card, Row, ScreenScaffold, Switch, SegmentedControl } from '../components/index'
import { useTheme, useThemePref, useAccent, useDensity } from '../theme/ThemeProvider'
import { usePreferences } from '../hooks/usePreferences'
import { SubScreenHeader } from './SubScreenHeader'
import type { ThemePref } from '../theme/resolveMode'
import type { AccentTheme, Density } from '@mydevtime/design'

/**
 * Settings (ux-vision §3) — the preferences, subscription, and data controls the
 * Profile hub links into. The preference toggles persist per user + workspace via
 * the `preferences` API (M10, optimistic with rollback); the subscription and
 * data-export/delete rows are the entry points the billing (#34) and account (#5)
 * flows will own. Consent and data-ownership items are surfaced explicitly
 * (REQ-025 / GDPR), not buried.
 */
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

  // Persisted per user + workspace (M10); optimistic, saved via the preferences API.
  const { prefs, setPref: setToggle, live: prefsLive } = usePreferences()

  // Entry points whose flow isn't built yet: shown honestly as "coming soon" rather
  // than as a tappable chevron that does nothing (audit M-4).
  const soon = <Badge tone="neutral">Bald verfügbar</Badge>

  return (
    <ScreenScaffold
      header={
        <SubScreenHeader
          title="Settings"
          subtitle="Preferences, plan & your data"
          onBack={onBack}
        />
      }
    >
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
        <SectionLabel>{`Preferences${prefsLive ? '' : ' · nicht gespeichert (offline)'}`}</SectionLabel>
        <Card>
          <Row
            title="Focus reminders"
            subtitle="Nudge when a planned block starts"
            trailing={
              <Switch
                checked={prefs.reminders}
                onChange={v => setToggle('reminders', v)}
                accessibilityLabel="Focus reminders"
              />
            }
          />
          <Row
            title="Break reminders"
            subtitle="Prompt for a break after a focus run"
            trailing={
              <Switch
                checked={prefs.breakReminders}
                onChange={v => setToggle('breakReminders', v)}
                accessibilityLabel="Break reminders"
              />
            }
          />
          <Row
            title="Idle detection"
            subtitle="Ask what to do with away time"
            trailing={
              <Switch
                checked={prefs.idleDetection}
                onChange={v => setToggle('idleDetection', v)}
                accessibilityLabel="Idle detection"
              />
            }
          />
          <Row
            title="Calendar sync"
            subtitle="Pull events as capture candidates"
            trailing={
              <Switch
                checked={prefs.calendarSync}
                onChange={v => setToggle('calendarSync', v)}
                accessibilityLabel="Calendar sync"
              />
            }
          />
          <Row
            title="Auto-tracker"
            subtitle="Suggest entries from app/editor usage"
            trailing={
              <Switch
                checked={prefs.autoTracker}
                onChange={v => setToggle('autoTracker', v)}
                accessibilityLabel="Auto-tracker"
              />
            }
          />
          <Row
            title="Week starts Monday"
            trailing={
              <Switch
                checked={prefs.weekStartMonday}
                onChange={v => setToggle('weekStartMonday', v)}
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
                checked={prefs.meetingConsent}
                onChange={v => setToggle('meetingConsent', v)}
                accessibilityLabel="Allow meeting recording"
              />
            }
          />
          <Row title="AI credits" subtitle="Balance, ledger & packs" trailing={soon} />
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
            trailing={soon}
          />
        </Card>
      </View>

      <View>
        <SectionLabel>Data & privacy</SectionLabel>
        <Card>
          <Row title="Export my data" subtitle="Entries, transcripts & reports" trailing={soon} />
          <Row title="Delete account" subtitle="Erases your workspace and data" trailing={soon} />
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
    </ScreenScaffold>
  )
}
