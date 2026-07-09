import { ScrollView, View } from 'react-native'
import { formatSigned } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, ProgressBar, Row } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'

/**
 * AI credits (#34, ADR-0008) — the visible credit ledger the Profile hub links
 * into. Every AI action debits credits here; the balance and history are the
 * source of truth a feature gate reads (never a payment SDK). Figures are
 * illustrative until the billing credit domain feeds them, but the append-only
 * ledger shape and the signed tabular deltas are the real primitives.
 */
interface LedgerEntry {
  readonly id: string
  readonly label: string
  readonly when: string
  readonly delta: number
}

const BALANCE = 488
const GRANT = 500
const LEDGER: readonly LedgerEntry[] = [
  { id: 'l1', label: 'Monthly Pro grant', when: 'Jul 1', delta: 500 },
  { id: 'l2', label: 'Meeting summary — Finanzo review', when: 'Jul 7', delta: -8 },
  { id: 'l3', label: 'Natural-language time entry', when: 'Jul 8', delta: -4 },
  { id: 'l4', label: 'Assistant — budget question', when: 'Jul 8', delta: -1 },
  { id: 'l5', label: 'Co-Planner day proposal', when: 'Jul 9', delta: -2 },
]

interface UsageBucket {
  readonly label: string
  readonly credits: number
}
const USAGE: readonly UsageBucket[] = [
  { label: 'Meeting insights', credits: 8 },
  { label: 'Co-Planner', credits: 2 },
  { label: 'NL time entry', credits: 4 },
  { label: 'Assistant', credits: 1 },
]

export function CreditsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const spent = GRANT - BALANCE
  const usageMax = Math.max(...USAGE.map(u => u.credits))

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <SubScreenHeader
        title="AI Credits"
        subtitle="Every AI action is metered here"
        onBack={onBack}
      />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xl,
              fontWeight: '700',
              color: t.color.ink,
            }}
          >
            {String(BALANCE)}
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>credits left</Text>
          <Badge tone="accent">Pro</Badge>
        </View>
        <View style={{ marginTop: t.spacing.s3 }}>
          <ProgressBar ratio={spent / GRANT} label="Credits used this cycle" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: t.spacing.s2,
          }}
        >
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            {String(spent)} of {String(GRANT)} used
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>renews Aug 1</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: t.spacing.s4 }}>
          <Button size="sm" variant="secondary" onPress={() => undefined}>
            Buy a credit pack
          </Button>
        </View>
      </Card>

      <View>
        <SectionLabel>Usage this cycle</SectionLabel>
        <Card>
          <View style={{ gap: t.spacing.s3 }}>
            {USAGE.map(u => (
              <View key={u.label} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{u.label}</Text>
                  <Text
                    style={{
                      fontFamily: t.fontFamily.numeric,
                      fontSize: t.fontSize.sm,
                      color: t.color.ink2,
                    }}
                  >
                    {String(u.credits)}
                  </Text>
                </View>
                <ProgressBar ratio={u.credits / usageMax} label={`${u.label} usage`} />
              </View>
            ))}
          </View>
        </Card>
      </View>

      <View>
        <SectionLabel>Ledger</SectionLabel>
        <Card>
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
                    fontWeight: '600',
                    color: entry.delta < 0 ? t.color.ink2 : t.color.good,
                  }}
                >
                  {formatSigned(entry.delta)}
                </Text>
              }
            />
          ))}
        </Card>
      </View>

      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
        Feature gates read this balance, never a payment SDK (ADR-0008). Credits never expire
        mid-cycle — unused grant resets on renewal.
      </Text>
    </ScrollView>
  )
}

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
