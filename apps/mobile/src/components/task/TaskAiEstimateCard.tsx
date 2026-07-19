import { useState } from 'react'
import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import {
  requestEstimate,
  type EstimateCategory,
  type EstimateComplexity,
  type EstimateInput,
  type EstimateProposal,
} from '../../api/estimate.js'
import { Text } from '../core/Text'
import { Badge, Button } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * AI task-estimate review (REQ-041, ADR-0005/0029). The user asks the AI for an effort estimate;
 * the server returns a **proposal only** — a suggested duration, the deterministic baseline range
 * it sits in, and a rationale. The card shows the provenance honestly: an `ai-proposal` is labelled
 * as such and marked as having spent a credit; a `deterministic` result is labelled a free baseline
 * (the provider was down, out of credits, or unparseable) — never dressed up as an AI estimate.
 * Nothing is written to the task until the user taps Apply, which hands the estimate (in minutes) to
 * the caller's `onApply` — the ordinary `setTaskEstimate` tracking mutation. The AI proposes; the
 * user confirms; only then does the deterministic core persist the number.
 */
const CATEGORIES: readonly EstimateCategory[] = ['feature', 'bug', 'chore', 'research', 'meeting']
const COMPLEXITIES: readonly EstimateComplexity[] = [
  'trivial',
  'small',
  'medium',
  'large',
  'xlarge',
]

function asCategory(v: string | null | undefined): EstimateCategory {
  return v != null && (CATEGORIES as readonly string[]).includes(v)
    ? (v as EstimateCategory)
    : 'feature'
}
function asComplexity(v: string | null | undefined): EstimateComplexity {
  return v != null && (COMPLEXITIES as readonly string[]).includes(v)
    ? (v as EstimateComplexity)
    : 'medium'
}

/** Render a minutes count through the shared duration helper (`H:MM h`). */
function minutesLabel(minutes: number): string {
  return `${formatDuration(minutes * 60_000)} h`
}

export interface TaskAiEstimateCardProps {
  /** The backend base URL, or `null` on demo data (the request button is then disabled). */
  readonly baseUrl: string | null
  readonly category: string | null
  readonly complexity: string | null
  /** An optional free-text hint sent to the estimator (max 500 chars, server-enforced). */
  readonly note?: string
  /** True while the caller's apply mutation is in flight. */
  readonly applying?: boolean
  /** Apply a reviewed proposal: persist `estimateMinutes` via the real task API. */
  readonly onApply: (estimateMinutes: number) => void
}

export function TaskAiEstimateCard({
  baseUrl,
  category,
  complexity,
  note,
  applying = false,
  onApply,
}: TaskAiEstimateCardProps): React.JSX.Element {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<EstimateProposal | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trimmedNote = note?.trim()

  const ask = async (): Promise<void> => {
    if (baseUrl === null) return
    const input: EstimateInput =
      trimmedNote != null && trimmedNote.length > 0
        ? {
            category: asCategory(category),
            complexity: asComplexity(complexity),
            note: trimmedNote,
          }
        : { category: asCategory(category), complexity: asComplexity(complexity) }
    setBusy(true)
    setError(null)
    try {
      setProposal(await requestEstimate(baseUrl, input))
    } catch (e) {
      setProposal(null)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  const isAi = proposal !== null && proposal.source === 'ai-proposal'

  return (
    <View
      style={{
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
        AI estimate
      </Text>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
        Asks the AI for an effort estimate from this task&apos;s category and complexity. It is a
        proposal you review — nothing is saved until you tap Apply.
      </Text>

      <View style={{ flexDirection: 'row' }}>
        <Button size="sm" disabled={busy || baseUrl === null} onPress={() => void ask()}>
          {busy ? 'Estimating…' : 'AI estimate'}
        </Button>
      </View>

      {baseUrl === null && (
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          Connect an account to get an AI estimate.
        </Text>
      )}

      {error !== null && (
        <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
          Estimate could not be generated — {error}
        </Text>
      )}

      {proposal !== null && (
        <View style={{ gap: t.spacing.s2 }}>
          <Badge tone={isAi ? 'accent' : 'neutral'} size="sm">
            {isAi ? 'AI proposal' : 'Baseline'}
          </Badge>

          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.lg,
              fontWeight: '700',
              color: t.color.ink,
            }}
          >
            {minutesLabel(proposal.estimateMinutes)}
          </Text>

          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {`Baseline ${minutesLabel(proposal.baselineMin)}–${minutesLabel(proposal.baselineMax)}`}
          </Text>

          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            {isAi ? '1 credit used' : 'Free baseline — provider unavailable or no credits'}
          </Text>

          {proposal.rationale.length > 0 && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
              {proposal.rationale}
            </Text>
          )}

          <View style={{ flexDirection: 'row' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={applying}
              onPress={() => onApply(proposal.estimateMinutes)}
            >
              {applying ? 'Applying…' : 'Apply estimate'}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
