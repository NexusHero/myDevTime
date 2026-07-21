import { useState } from 'react'
import { View } from 'react-native'
import {
  requestEveningCompanion,
  type CompanionDayInput,
  type CompanionLoadLevel,
  type CompanionSignal,
  type CompanionSuggestion,
  type CompanionTrend,
  type EveningCompanion,
} from '../../api/companion.js'
import { applyPlanProposal } from '../../api/planApply.js'
import { Text } from '../core/Text'
import { Badge, Button, Card } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The Evening Companion card (design v14 §H, ADR-0005/0029). It gathers the day's already-computed
 * signals from what Today already holds and, on a deliberate tap, asks the server to review the day.
 * The server's deterministic core owns every number (the load band, the signals, the week trend);
 * the LLM only weaves them into one warm voice — and only if the user can afford it. The card is
 * honest about provenance: an `ai-proposal` message owns up to the credit it spent; a `deterministic`
 * message is shown as a free, still-caring reflection (the provider was down or credits were out) —
 * never dressed up as AI. The one forward suggestion is a PROPOSAL: a `protect-morning` confirm
 * routes ONE protect-time proposal through the plan-apply seam (REQ-070) — a deterministic default
 * window, booked only on this explicit tap — and every confirm still hands the suggestion to
 * `onConfirmSuggestion` for the parent's acknowledgement. No other kind mutates anything (ADR-0005).
 */
export interface EveningCompanionCardProps {
  /** The backend base URL, or `null` on demo data (the reflect button is then disabled). */
  readonly baseUrl: string | null
  /** The local day under review as `'YYYY-MM-DD'` — the server records the load and windows worktime. */
  readonly date: string
  /** IANA time zone the day is local to; defaults to UTC on the server when omitted. */
  readonly tz?: string
  /** The day's raw signals, gathered by Today from its own real state. */
  readonly day: CompanionDayInput
  /** Confirm the forward suggestion — an honest proposal the parent routes/acknowledges, never books. */
  readonly onConfirmSuggestion?: (suggestion: CompanionSuggestion) => void
}

/** The wellbeing band as a human word + theme tone (no hardcoded colours). */
function bandChip(
  level: CompanionLoadLevel,
  t: ReturnType<typeof useTheme>,
): { label: string; bg: string; fg: string } {
  switch (level) {
    case 'overload':
      return { label: 'Overloaded', bg: t.color.critSoft, fg: t.color.crit }
    case 'heavy':
      return { label: 'Heavy', bg: t.color.warnSoft, fg: t.color.warn }
    case 'normal':
      return { label: 'Steady', bg: t.color.overlay, fg: t.color.ink2 }
    case 'light':
      return { label: 'Light', bg: t.color.goodSoft, fg: t.color.good }
  }
}

/** The week trend as a gentle human line. */
function trendLabel(trend: CompanionTrend): string {
  if (trend === 'rising') return 'This week has been building'
  if (trend === 'falling') return 'This week has been easing off'
  return 'This week has held steady'
}

/** One signal as a short, human line. Every number is the server's (code's), never invented here. */
function signalLine(sig: CompanionSignal): string {
  const d = sig.detail
  const n = (key: string): string => String(d[key] ?? 0)
  switch (sig.kind) {
    case 'long-day':
      return `A long day — ${n('minutesOver')} min past nine hours`
    case 'overtime':
      return `${n('overtimeMinutes')} min of overtime`
    case 'break-shortfall':
      return `${n('shortfallMinutes')} min of breaks that slipped by`
    case 'back-to-back-meetings':
      return `${n('count')} meetings ran back-to-back`
    case 'meeting-heavy':
      return `${n('count')} meetings filled the day`
    case 'plan-overrun':
      return `About ${n('minutesOver')} min over today's plan`
    case 'low-mood':
      return 'You flagged the day as a tough one'
    default:
      return sig.kind
  }
}

/** The `YYYY-MM-DD` after `date` — UTC math so no local-tz midnight can shift the day. */
function nextDayIso(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + 1)
  return parsed.toISOString().slice(0, 10)
}

/**
 * The deterministic default 🛡 window a `protect-morning` confirm books: tomorrow
 * 08:00–12:00. Fixed by design — the suggestion says "protect the morning", and code (not
 * the LLM) decides what a morning is (ADR-0005); the Planner shows the window afterwards
 * and the user can reshape it there.
 */
const PROTECT_MORNING_START_MIN = 8 * 60
const PROTECT_MORNING_END_MIN = 12 * 60

/** A short confirm label for the forward suggestion, by its kind. */
function confirmLabel(kind: string): string {
  switch (kind) {
    case 'protect-morning':
      return 'Protect tomorrow morning'
    case 'space-meetings':
      return 'Space out tomorrow'
    case 'take-breaks':
      return 'Plan real breaks'
    case 'right-size-plan':
      return 'Right-size tomorrow'
    case 'gentle-tomorrow':
      return 'Go gentle tomorrow'
    case 'rest-day':
      return 'Enjoy the rest'
    default:
      return 'Take into tomorrow'
  }
}

export function EveningCompanionCard({
  baseUrl,
  date,
  tz,
  day,
  onConfirmSuggestion,
}: EveningCompanionCardProps): React.JSX.Element {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EveningCompanion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reflect = async (): Promise<void> => {
    if (baseUrl === null) return
    setBusy(true)
    setError(null)
    try {
      const input = tz !== undefined ? { date, tz, day } : { date, day }
      setResult(await requestEveningCompanion(baseUrl, input))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  const isAi = result !== null && result.message.source === 'ai-proposal'
  const band = result !== null ? bandChip(result.review.loadLevel, t) : null
  const topSignals = result?.review.signals.slice(0, 3) ?? []
  const suggestion = result?.suggestion

  // The one confirm-gated mutation (REQ-070): a `protect-morning` confirm books tomorrow's
  // default 🛡 window through the plan-apply seam — exactly one proposal, only on this tap.
  // Every kind (including a failed apply — surfaced via the card's error line, never
  // swallowed into a fake success) still hands the suggestion up for the parent's ack.
  const confirmSuggestion = async (s: CompanionSuggestion): Promise<void> => {
    if (s.kind === 'protect-morning' && baseUrl !== null) {
      try {
        await applyPlanProposal(baseUrl, {
          kind: 'protect-time',
          day: nextDayIso(date),
          startMin: PROTECT_MORNING_START_MIN,
          endMin: PROTECT_MORNING_END_MIN,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    }
    onConfirmSuggestion?.(s)
  }

  return (
    <Card title="Evening Companion" subtitle="Your day, in one voice">
      <View style={{ gap: t.spacing.s3 }}>
        {result === null ? (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            One warm look back at today — the load you carried, how the week is going, and one
            gentle idea for tomorrow. A reflection, never a verdict. Nothing is changed for you.
          </Text>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: t.spacing.s2,
              }}
            >
              {band !== null && (
                <View
                  style={{
                    paddingHorizontal: t.spacing.s2,
                    paddingVertical: 2,
                    borderRadius: t.radius.chip,
                    backgroundColor: band.bg,
                  }}
                >
                  <Text style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: band.fg }}>
                    {band.label}
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                {trendLabel(result.baseline.trend)}
              </Text>
              <Badge tone={isAi ? 'accent' : 'neutral'} size="sm">
                {isAi ? 'AI proposal' : 'Reflection'}
              </Badge>
            </View>

            {result.message.text.length > 0 && (
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, lineHeight: 20 }}>
                {result.message.text}
              </Text>
            )}

            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
              {isAi
                ? '1 credit used'
                : 'Free reflection — provider unavailable or no credits, still yours'}
            </Text>

            {topSignals.length > 0 && (
              <View style={{ gap: 4 }}>
                {topSignals.map((sig, i) => (
                  <Text
                    key={`${sig.kind}-${String(i)}`}
                    style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}
                  >
                    {`· ${signalLine(sig)}`}
                  </Text>
                ))}
              </View>
            )}

            {suggestion !== undefined && suggestion.text.length > 0 && (
              <View
                style={{
                  gap: t.spacing.s2,
                  padding: t.spacing.s3,
                  borderRadius: t.radius.card,
                  borderWidth: 1,
                  borderColor: t.color.accentSoft,
                  backgroundColor: t.color.accentSoft,
                }}
              >
                <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink }}>
                  {suggestion.text}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => void confirmSuggestion(suggestion)}
                  >
                    {confirmLabel(suggestion.kind)}
                  </Button>
                </View>
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                  A proposal — nothing is booked until you plan it.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ flexDirection: 'row' }}>
          <Button size="sm" disabled={busy || baseUrl === null} onPress={() => void reflect()}>
            {busy ? 'Reflecting…' : result === null ? 'Reflect on today' : 'Reflect again'}
          </Button>
        </View>

        {baseUrl === null && (
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            Connect an account for your evening reflection.
          </Text>
        )}

        {error !== null && (
          <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
            Your reflection could not be loaded — {error}
          </Text>
        )}
      </View>
    </Card>
  )
}
