import { View } from 'react-native'
import { formatSigned } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, ProgressBar, Row, ScreenListScaffold } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { useCredits } from '../hooks/useCredits'
import { prettyCategory } from '../api/credits'

/**
 * AI credits (#34, REQ-027, ADR-0008) — the visible credit ledger the Profile hub
 * links into. Every AI action debits credits here; the balance and history are the
 * source of truth a feature gate reads (never a payment SDK). Fed by the `billing`
 * credit service (`useCredits`) — the balance, ledger and usage are the
 * deterministic core's (ADR-0005) — with demo data as the offline fallback.
 */
export function CreditsScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const credits = useCredits()
  const data = credits.data
  const balance = data?.balance ?? 0
  const granted = data?.grantedTotal ?? 0
  const spent = data?.spentTotal ?? 0
  const ledger = data?.ledger ?? []
  const usage = data?.usage ?? []
  const usageMax = Math.max(1, ...usage.map(u => u.credits))

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s2 }}>
      <View style={{ flex: 1 }}>
        <SubScreenHeader
          title="AI Credits"
          subtitle="Every AI action is metered here"
          onBack={onBack}
        />
      </View>
      {!credits.live && <Badge tone="neutral">Demo data</Badge>}
    </View>
  )

  // The balance + usage cards ride above the ledger as the list header; the ledger
  // itself is the virtualized body (it grows with every AI action, so it is the one
  // unbounded list on this screen — ADR-0045 §Perf).
  const listHeader = (
    <View style={{ gap: t.spacing.s4 }}>
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
            {String(balance)}
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>credits left</Text>
          <Badge tone="accent">Pro</Badge>
        </View>
        <View style={{ marginTop: t.spacing.s3 }}>
          <ProgressBar ratio={granted > 0 ? spent / granted : 0} label="Credits used this cycle" />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: t.spacing.s2,
          }}
        >
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            {String(spent)} of {String(granted)} used
          </Text>
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>this cycle</Text>
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
          {usage.length === 0 ? (
            <Text style={{ color: t.color.ink2 }}>No AI usage this cycle yet.</Text>
          ) : (
            <View style={{ gap: t.spacing.s3 }}>
              {usage.map(u => {
                const label = prettyCategory(u.category)
                return (
                  <View key={u.category} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{label}</Text>
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
                    <ProgressBar ratio={u.credits / usageMax} label={`${label} usage`} />
                  </View>
                )
              })}
            </View>
          )}
        </Card>
      </View>

      <SectionLabel>Ledger</SectionLabel>
    </View>
  )

  const listFooter = (
    <Text
      style={{
        fontSize: t.fontSize.xs,
        color: t.color.ink3,
        lineHeight: 18,
        marginTop: t.spacing.s4,
      }}
    >
      Feature gates read this balance, never a payment SDK (ADR-0008). Credits never expire
      mid-cycle — unused grant resets on renewal.
    </Text>
  )

  return (
    <ScreenListScaffold
      header={header}
      data={ledger}
      keyExtractor={entry => entry.id}
      estimatedItemSize={64}
      listHeader={listHeader}
      listFooter={listFooter}
      listEmpty={
        <Card>
          <Text style={{ color: t.color.ink2 }}>No credit activity yet.</Text>
        </Card>
      }
      renderItem={({ item: entry }) => (
        <Row
          title={entry.reason ?? prettyCategory(entry.category)}
          subtitle={entry.at.slice(0, 10)}
          trailing={
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.sm,
                fontWeight: '600',
                color: entry.amount < 0 ? t.color.ink2 : t.color.good,
              }}
            >
              {formatSigned(entry.amount)}
            </Text>
          }
        />
      )}
    />
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
