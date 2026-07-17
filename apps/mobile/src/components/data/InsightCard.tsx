import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '../core/Text'
import { Badge, Button, Card } from '../index'
import { useTheme } from '../../theme/ThemeProvider'
import { apiBaseUrl } from '../../config'
import { fetchInsight, type InsightKind, type InsightProposal } from '../../api/aiInsights'

/**
 * A grounded AI insight surface (REQ-054, design v13 KI1–KI4). The caller supplies the
 * deterministic facts; on demand the server's LLM phrases them into a proposal that this
 * card renders with a **violet AI signature** only when it's a real `ai-proposal`. It
 * refuses cleanly off-data, degrades to a deterministic fallback, and costs one credit per
 * real proposal (ADR-0005/0029). Needs a backend; offline it says so.
 */
export function InsightCard({
  kind,
  title,
  subtitle,
  facts,
  cta,
}: {
  readonly kind: InsightKind
  readonly title: string
  readonly subtitle: string
  readonly facts: readonly string[]
  readonly cta: string
}): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InsightProposal | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ask = (): void => {
    if (base === null || facts.length === 0) return
    setBusy(true)
    setError(null)
    fetchInsight(base, kind, facts)
      .then(setResult)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }

  const isAi = result?.source === 'ai-proposal'

  return (
    <Card title={title} subtitle={subtitle}>
      {base === null ? (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
          Connect a backend to use grounded AI.
        </Text>
      ) : (
        <View style={{ gap: t.spacing.s3 }}>
          {result !== null && (
            <View
              style={{
                padding: t.spacing.s3,
                borderRadius: t.radius.chip,
                backgroundColor: isAi ? t.color.aiSoft : t.color.raised,
                borderWidth: isAi ? 1 : 0,
                borderColor: isAi ? t.color.aiInk : 'transparent',
                gap: t.spacing.s2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                {isAi ? (
                  <Text
                    style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.aiInk }}
                  >
                    ✦ AI proposal
                  </Text>
                ) : (
                  <Badge tone="neutral">Deterministic</Badge>
                )}
                {result.refused && <Badge tone="warn">No data</Badge>}
                {result.charged && (
                  <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                    −1 credit
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>{result.text}</Text>
            </View>
          )}
          {error !== null && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>{error}</Text>
          )}
          <Button size="sm" variant="secondary" disabled={busy || facts.length === 0} onPress={ask}>
            {busy ? 'Thinking…' : cta}
          </Button>
        </View>
      )}
    </Card>
  )
}
