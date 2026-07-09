import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { formatDuration, formatSigned } from '@mydevtime/design'
import { useTheme } from '../theme/ThemeProvider'
import { Badge, Card, ProgressBar, Row, Switch } from '../components/index'

/**
 * Profile — the personal hub (ux-vision §3): identity + plan, the AI-credit
 * balance and ledger preview (#34), the work-time story (overtime balance,
 * weekly target, absences #37), and settings. Numbers render via the design
 * `format*` helpers; the credit balance and absences are illustrative until the
 * ledger (#34) and absence (#37) domains feed them, but the tabular formatting
 * and the vacation consumption bar are the real, shared primitives.
 */
interface LedgerEntry {
  readonly id: string
  readonly label: string
  readonly when: string
  readonly delta: number
}

const CREDIT_BALANCE = 488
const LEDGER: readonly LedgerEntry[] = [
  { id: 'l1', label: 'Monthly Pro grant', when: 'Jul 1', delta: 500 },
  { id: 'l2', label: 'Meeting summary — Nordwind', when: 'Jul 7', delta: -8 },
  { id: 'l3', label: 'NL time entry', when: 'Jul 8', delta: -4 },
]

const VACATION_USED = 18
const VACATION_ALLOWANCE = 30
const OVERTIME_MS = 9 * 3_600_000 + 30 * 60_000
const WEEKLY_TARGET_MS = 40 * 3_600_000

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

export function ProfileScreen(): React.JSX.Element {
  const t = useTheme()
  const [reminders, setReminders] = useState(true)
  const [idleDetection, setIdleDetection] = useState(true)
  const [weekStartMonday, setWeekStartMonday] = useState(true)

  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }
  const vacationRatio = VACATION_USED / VACATION_ALLOWANCE

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      {/* Identity */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s4 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: t.color.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
        >
          <Text style={{ fontSize: t.fontSize.lg, fontWeight: '700', color: t.color.accentText }}>
            SS
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: t.fontSize.xl, fontWeight: '700', color: t.color.ink }}>
            Suhay Sevinç
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
            NexusHero workspace
          </Text>
        </View>
        <Badge tone="accent">Pro</Badge>
      </View>

      {/* AI credits */}
      <View>
        <SectionLabel>AI Credits</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
            <Text style={{ ...mono, fontSize: t.fontSize.xl, fontWeight: '700' }}>
              {String(CREDIT_BALANCE)}
            </Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>credits left</Text>
            <Text style={{ marginLeft: 'auto', fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              renews Aug 1
            </Text>
          </View>
          <View
            style={{
              marginTop: t.spacing.s3,
              paddingTop: t.spacing.s3,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
            }}
          >
            {LEDGER.map(entry => (
              <Row
                key={entry.id}
                title={entry.label}
                subtitle={entry.when}
                trailing={
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize.sm,
                      color: entry.delta < 0 ? t.color.ink2 : t.color.good,
                    }}
                  >
                    {formatSigned(entry.delta)}
                  </Text>
                }
              />
            ))}
          </View>
        </Card>
      </View>

      {/* Work time */}
      <View>
        <SectionLabel>Work time</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', gap: t.spacing.s5 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Overtime balance</Text>
              <Text style={{ ...mono, fontSize: t.fontSize.lg, fontWeight: '700', marginTop: 2 }}>
                {formatDuration(OVERTIME_MS)} h
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Weekly target</Text>
              <Text style={{ ...mono, fontSize: t.fontSize.lg, fontWeight: '700', marginTop: 2 }}>
                {formatDuration(WEEKLY_TARGET_MS)} h
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Absences */}
      <View>
        <SectionLabel>Absences</SectionLabel>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
            <Text style={{ ...mono, fontSize: t.fontSize.md, fontWeight: '700' }}>
              {String(VACATION_ALLOWANCE - VACATION_USED)}
            </Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>vacation days left</Text>
            <Text
              style={{ marginLeft: 'auto', ...mono, fontSize: t.fontSize.xs, color: t.color.ink3 }}
            >
              {String(VACATION_USED)}/{String(VACATION_ALLOWANCE)}
            </Text>
          </View>
          <View style={{ marginTop: t.spacing.s3 }}>
            <ProgressBar ratio={vacationRatio} label="Vacation days used" />
          </View>
          <View style={{ marginTop: t.spacing.s2 }}>
            <Row
              title="Open absence calendar"
              subtitle="Vacation, sick days, public holidays"
              trailing={<Text style={{ color: t.color.ink3, fontSize: t.fontSize.lg }}>›</Text>}
              onPress={() => undefined}
            />
          </View>
        </Card>
      </View>

      {/* Settings */}
      <View>
        <SectionLabel>Settings</SectionLabel>
        <Card>
          <Row
            title="Focus reminders"
            subtitle="Nudge when a planned block starts"
            trailing={
              <Switch checked={reminders} onChange={setReminders} label="Focus reminders" />
            }
          />
          <Row
            title="Idle detection"
            subtitle="Ask what to do with away time"
            trailing={
              <Switch checked={idleDetection} onChange={setIdleDetection} label="Idle detection" />
            }
          />
          <Row
            title="Week starts Monday"
            trailing={
              <Switch
                checked={weekStartMonday}
                onChange={setWeekStartMonday}
                label="Week starts Monday"
              />
            }
          />
          <Row
            title="Manage subscription"
            subtitle="Plan, payment method, invoices"
            trailing={<Text style={{ color: t.color.ink3, fontSize: t.fontSize.lg }}>›</Text>}
            onPress={() => undefined}
          />
        </Card>
      </View>
    </ScrollView>
  )
}
