import { useState } from 'react'
import { Alert, Platform, View } from 'react-native'
import { Text } from '../components/core/Text'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Row,
  ScreenScaffold,
  SegmentedControl,
  Switch,
  useToast,
} from '../components/index'
import { useTheme, useThemePref, useAccent, useDensity } from '../theme/ThemeProvider'
import { usePreferences } from '../hooks/usePreferences'
import { useAsync } from '../hooks/useAsync'
import { useVisibility } from '../roles/RoleContext'
import { useSessionContext } from '../shell/SessionContext'
import { confirmDestructive } from '../utils/confirmDestructive'
import { apiBaseUrl } from '../config.js'
import { deleteAccount, requestDataExport, triggerJsonDownload } from '../api/privacy.js'
import { createShare, listShares, revokeShare, shareLinkUrl, type Share } from '../api/sharing.js'
import { SubScreenHeader } from './SubScreenHeader'
import type { ThemePref } from '../theme/resolveMode'
import type { AccentTheme, Density } from '@mydevtime/design'
import type { UserRole } from '@mydevtime/domain'

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
  // Role visibility preset (design v14 §R): the role decides which modules a person sees.
  const { role, setRole } = useVisibility()

  // Persisted per user + workspace (M10); optimistic, saved via the preferences API.
  const { prefs, setPref: setToggle, live: prefsLive } = usePreferences()

  // Entry points whose flow isn't built yet: shown honestly as "coming soon" rather
  // than as a tappable chevron that does nothing (audit M-4).
  const soon = <Badge tone="neutral">Coming soon</Badge>

  // GDPR data controls (REQ-020) and partner-light Free/Busy sharing (§F6) are API-backed. With
  // no workspace configured (demo/local), the actions are honestly inert and the UI says so —
  // the app never fakes an export, a deletion, or a share link.
  const base = apiBaseUrl
  const live = base !== null
  const toast = useToast()
  const session = useSessionContext()

  const errMessage = (e: unknown, fallback: string): string =>
    e instanceof Error && e.message ? e.message : fallback

  // Export my data — fetch the full bundle, download it as JSON on web, toast on native.
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const onExport = (): void => {
    if (base === null || exporting) return
    setExporting(true)
    setExportError(null)
    requestDataExport(base)
      .then(bundle => {
        const stamp = new Date().toISOString().slice(0, 10)
        const downloaded =
          Platform.OS === 'web'
            ? triggerJsonDownload(bundle, `mydevtime-export-${stamp}.json`)
            : false
        toast.show(
          downloaded
            ? 'Your data export was downloaded.'
            : 'Your data export is ready — open the web app to download the file.',
        )
      })
      .catch((e: unknown) => {
        setExportError(errMessage(e, 'Export failed. Please try again.'))
      })
      .finally(() => {
        setExporting(false)
      })
  }

  // Delete account — irreversible, so it is gated twice: the user must type DELETE to arm the
  // button, and a final destructive confirmation runs before the request. On success the session
  // ends and the app returns to the auth gate. Never a one-tap delete.
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const armed = confirmText.trim().toUpperCase() === 'DELETE'
  const onDelete = (): void => {
    if (base === null || deleting || !armed) return
    confirmDestructive({
      title: 'Delete account permanently?',
      message: 'This erases your workspace and all of your data. This cannot be undone.',
      confirmLabel: 'Delete forever',
      onConfirm: () => {
        setDeleting(true)
        setDeleteError(null)
        deleteAccount(base, { confirm: 'DELETE' })
          .then(() => {
            toast.show('Your account and data were deleted.')
            void session.signOut()
          })
          .catch((e: unknown) => {
            setDeleteError(errMessage(e, 'Account could not be deleted. Please try again.'))
            setDeleting(false)
          })
      },
    })
  }

  // Free/Busy sharing (§F6). Loaded inline via the async seam; empty (and mutators inert) when no
  // workspace is configured — the app fabricates no links.
  const shares = useAsync<Share[]>(
    () => (base !== null ? listShares(base) : Promise.resolve<Share[]>([])),
    base !== null ? `shares:${base}` : 'shares:empty',
  )
  const [shareLabel, setShareLabel] = useState('')
  const [creatingShare, setCreatingShare] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const onCreateShare = (): void => {
    if (base === null || creatingShare) return
    setCreatingShare(true)
    setShareError(null)
    createShare(base, { label: shareLabel.trim() || null })
      .then(() => {
        setShareLabel('')
        shares.reload()
        toast.show('Free/Busy link created.')
      })
      .catch((e: unknown) => {
        setShareError(errMessage(e, 'Link could not be created. Please try again.'))
      })
      .finally(() => {
        setCreatingShare(false)
      })
  }
  const onRevokeShare = (s: Share): void => {
    confirmDestructive({
      title: 'Revoke this link?',
      message: 'Anyone using this link will immediately lose access to your Free/Busy.',
      confirmLabel: 'Revoke',
      onConfirm: () => {
        if (base === null) return
        setShareError(null)
        revokeShare(base, s.id)
          .then(() => shares.reload())
          .catch((e: unknown) => {
            setShareError(errMessage(e, 'Link could not be revoked. Please try again.'))
          })
      },
    })
  }
  const onCopyLink = (s: Share): void => {
    const url = shareLinkUrl(base ?? '', s.token)
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard !== undefined
    ) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          toast.show('Link copied to clipboard.')
        })
        .catch(() => {
          toast.show('Copy failed — select the link to copy it manually.')
        })
      return
    }
    // Native has no bundled clipboard — surface the link so it can be copied by hand.
    Alert.alert('Free/Busy link', url)
  }
  const shortWhen = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10)
  }
  const shareList = shares.data ?? []

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

      {/* Role (design v14 §R): a visibility preset, not a fork. Freelance reveals clients,
          rates, billing, travel and the AI features; Employed keeps the work-time story only
          (no €/clients/billing). Health & Balance stays in every role. */}
      <View>
        <SectionLabel>What do you use DevTime for?</SectionLabel>
        <Card>
          <View style={{ padding: t.spacing.s4, gap: t.spacing.s3 }}>
            <SegmentedControl<UserRole>
              segments={[
                { value: 'employee', label: 'Employed' },
                { value: 'freelancer', label: 'Freelance' },
                { value: 'both', label: 'Both' },
              ]}
              active={role}
              onChange={setRole}
            />
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, lineHeight: 18 }}>
              {role === 'employee'
                ? 'Employed: the work-time story — punch clock, overtime, absences, timesheet export. No clients, rates or billing.'
                : role === 'freelancer'
                  ? 'Freelance: everything above plus clients, rates, invoicing, travel and the AI features.'
                  : 'Both: the full set — the work-time story and the freelance tools together.'}
            </Text>
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
              Health & Balance is always available — it is never paywalled.
            </Text>
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>{`Preferences${prefsLive ? '' : ' · not saved (offline)'}`}</SectionLabel>
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
            subtitle="Plans & pricing arrive with billing"
            trailing={soon}
          />
          <Row
            title="Manage subscription"
            subtitle="Payment method, invoices, cancel"
            trailing={soon}
          />
        </Card>
      </View>

      {/* Free/Busy sharing (§F6) — partner-light links. One link, free to view, and it exposes
          ONLY when you are busy: never a title, project or note. No account needed to open it. */}
      <View>
        <SectionLabel>Free / Busy sharing</SectionLabel>
        <Card>
          <View style={{ gap: t.spacing.s3 }}>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, lineHeight: 18 }}>
              Share a partner-light link. Anyone with it sees only when you are busy — never what
              you are working on (no title, project or note). No account needed to open it.
            </Text>

            <View>
              <Text
                style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginBottom: t.spacing.s1 }}
              >
                Label (optional)
              </Text>
              <Input
                value={shareLabel}
                onChangeText={setShareLabel}
                placeholder="e.g. Design partner"
              />
            </View>
            <Button onPress={onCreateShare} disabled={!live || creatingShare}>
              {creatingShare ? 'Creating…' : 'Create share link'}
            </Button>
            {!live && (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                Connect a workspace to create links — this is a preview.
              </Text>
            )}
            {shareError !== null && (
              <Text
                accessibilityRole="alert"
                style={{ fontSize: t.fontSize.sm, color: t.color.crit }}
              >
                {shareError}
              </Text>
            )}

            <View
              style={{
                marginTop: t.spacing.s2,
                paddingTop: t.spacing.s3,
                borderTopWidth: 1,
                borderTopColor: t.color.border,
                gap: t.spacing.s2,
              }}
            >
              {shareList.length === 0 ? (
                <EmptyState
                  compact
                  icon="shield"
                  title="No links yet"
                  hint="Create a link to let a partner see your Free/Busy — busy times only."
                />
              ) : (
                shareList.map(s => (
                  <View
                    key={s.id}
                    style={{
                      borderWidth: 1,
                      borderColor: t.color.border,
                      borderRadius: t.radius.block,
                      padding: t.spacing.s3,
                      gap: t.spacing.s2,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: t.spacing.s2,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}
                        >
                          {s.label ?? 'Free/Busy link'}
                        </Text>
                        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                          {`Created ${shortWhen(s.createdAt)}`}
                        </Text>
                      </View>
                      <Badge tone="neutral">Busy times only</Badge>
                    </View>
                    <Text
                      selectable
                      numberOfLines={1}
                      style={{
                        fontFamily: t.fontFamily.numeric,
                        fontSize: t.fontSize['2xs'],
                        color: t.color.ink2,
                      }}
                    >
                      {shareLinkUrl(base ?? '', s.token)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                      <Button size="sm" variant="secondary" onPress={() => onCopyLink(s)}>
                        Copy link
                      </Button>
                      <IconButton
                        icon={<Icon name="x" size={16} color={t.color.crit} />}
                        label={`Revoke ${s.label ?? 'Free/Busy link'}`}
                        onPress={() => onRevokeShare(s)}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>Data & privacy</SectionLabel>
        <Card>
          <View style={{ gap: t.spacing.s4 }}>
            <View style={{ gap: t.spacing.s2 }}>
              <Row
                title="Export my data"
                subtitle="A complete JSON copy of your workspace (GDPR)"
                trailing={
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={onExport}
                    disabled={!live || exporting}
                  >
                    {exporting ? 'Exporting…' : 'Export'}
                  </Button>
                }
              />
              {!live && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                  Connect a workspace to export your data.
                </Text>
              )}
              {exportError !== null && (
                <Text
                  accessibilityRole="alert"
                  style={{ fontSize: t.fontSize.sm, color: t.color.crit }}
                >
                  {exportError}
                </Text>
              )}
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: t.color.crit,
                borderRadius: t.radius.block,
                padding: t.spacing.s3,
                gap: t.spacing.s3,
              }}
            >
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
                Delete account
              </Text>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, lineHeight: 18 }}>
                This permanently erases your workspace and all of your data — entries, reports,
                shares, everything. It cannot be undone. Type DELETE to confirm.
              </Text>
              <Input
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Type DELETE to confirm"
              />
              <Button variant="danger" onPress={onDelete} disabled={!live || !armed || deleting}>
                {deleting ? 'Deleting…' : 'Delete account'}
              </Button>
              {!live && (
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                  Connect a workspace to manage account deletion.
                </Text>
              )}
              {deleteError !== null && (
                <Text
                  accessibilityRole="alert"
                  style={{ fontSize: t.fontSize.sm, color: t.color.crit }}
                >
                  {deleteError}
                </Text>
              )}
            </View>
          </View>
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
