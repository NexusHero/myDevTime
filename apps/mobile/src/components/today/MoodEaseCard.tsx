import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import {
  LOW_MOOD_MAXIMUM,
  MIN_SHRUNK_BLOCK_MIN,
  blockIdOf,
  moodScoreOf,
} from '@mydevtime/domain'
import { getMoodHistory } from '../../api/mood.js'
import { getPlan, type DayPlan } from '../../api/planner.js'
import { applyPlanProposal } from '../../api/planApply.js'
import { pick } from '../../i18n/strings.js'
import { Text } from '../core/Text'
import { Badge, Button, Card } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The MoodEaseCard — Sevi's "make today lighter" proposal (REQ-068/070, ADR-0071). When
 * today's consented punch-out mood runs low (tense/stressed via the fixed `moodScoreOf`
 * mapping) AND a persisted plan holds a focus block, Sevi proposes ONE concrete, code-computed
 * ease: shrink the LARGEST focus block by 25 % (never below the planner's 15-minute minimum).
 * Everything here is deterministic (ADR-0005) — the proposal is shown with its provenance chip
 * and applies (via the plan-apply seam, exactly once) only on an explicit confirm; a dismiss
 * does nothing and is remembered for the session, so Sevi never nags twice about the same day.
 * With no consent, no stored mood, a good mood, or no plan, the card renders nothing at all.
 *
 * Standalone by design: it fetches its own two facts (today's mood, today's plan) through the
 * existing seams. Intended mount point (integration, not here): `TodayScreen`'s main column,
 * directly ABOVE the `EveningCompanionCard` — a morning/day companion piece to the evening one.
 */
export interface MoodEaseCardProps {
  /** The backend base URL, or `null` on demo data (Sevi then simply stays quiet). */
  readonly baseUrl: string | null
  /** The local day under review as `'YYYY-MM-DD'` — "today" is passed in, never read here. */
  readonly date: string
}

/** The concrete, code-computed ease for a plan, or `null` when there is nothing to shrink. */
interface EaseProposal {
  readonly planId: string
  readonly blockId: string
  readonly byMin: number
  readonly blockLabel: string
}

/**
 * Pick the LARGEST focus block (first wins a tie — deterministic) and shrink it by 25 %,
 * clamped so the block never falls below the planner's minimum. `null` when the plan holds no
 * focus block or the largest one is already at the floor.
 */
function easeProposalFor(plan: DayPlan): EaseProposal | null {
  let bestIndex = -1
  plan.blocks.forEach((block, index) => {
    if (block.kind !== 'focus') return
    if (bestIndex === -1 || block.lenMin > (plan.blocks[bestIndex]?.lenMin ?? 0)) bestIndex = index
  })
  const best = plan.blocks[bestIndex]
  if (best === undefined) return null
  const byMin = Math.min(Math.round(best.lenMin / 4), best.lenMin - MIN_SHRUNK_BLOCK_MIN)
  if (byMin <= 0) return null
  return { planId: plan.id, blockId: blockIdOf(bestIndex), byMin, blockLabel: best.label }
}

// Session memory for dismissed days (module scope, deliberately not persisted): "not today"
// means not again today — but a fresh app start may gently ask again.
const dismissedDays = new Set<string>()

export function MoodEaseCard({ baseUrl, date }: MoodEaseCardProps): React.JSX.Element | null {
  const t = useTheme()
  const [proposal, setProposal] = useState<EaseProposal | null>(null)
  const [dismissed, setDismissed] = useState(dismissedDays.has(date))
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)
  // Synchronous in-flight latch: state updates are batched, so a double-tap would pass a
  // state-only guard twice — the ref makes "exactly one confirmed apply" hold under any tap.
  const sentRef = useRef(false)

  useEffect(() => {
    if (baseUrl === null || dismissedDays.has(date)) return
    let alive = true
    Promise.all([getMoodHistory(baseUrl), getPlan(baseUrl, date)])
      .then(([history, plan]) => {
        if (!alive) return
        // Only TODAY's stored word counts, and only when it is low — a mood the person did not
        // log today is never guessed from older days (consent-off histories are simply empty).
        const mood = history.find(m => m.day === date)?.mood
        const low = mood !== undefined && moodScoreOf(mood) <= LOW_MOOD_MAXIMUM
        setProposal(low && plan !== null ? easeProposalFor(plan) : null)
      })
      .catch(() => {
        // A failed read never surfaces as a nudge — Sevi stays quiet rather than guessing.
        if (alive) setProposal(null)
      })
    return () => {
      alive = false
    }
  }, [baseUrl, date])

  const confirm = async (): Promise<void> => {
    if (proposal === null || baseUrl === null || sentRef.current) return
    sentRef.current = true
    setBusy(true)
    try {
      // Exactly ONE confirmed proposal reaches the plan-apply seam; the mutation is the
      // server core's (ADR-0005) — this card only confirms.
      await applyPlanProposal(baseUrl, {
        kind: 'shrink-block',
        planId: proposal.planId,
        blockId: proposal.blockId,
        byMin: proposal.byMin,
      })
      setApplied(true)
    } catch {
      // The plan is untouched on failure; the card stays offered and may be confirmed again.
      sentRef.current = false
    } finally {
      setBusy(false)
    }
  }

  const dismiss = (): void => {
    dismissedDays.add(date)
    setDismissed(true)
  }

  if (baseUrl === null || dismissed || proposal === null) return null

  return (
    <Card
      title={pick('Make today lighter?', 'Heute leichter machen?')}
      subtitle={pick('A gentle idea from Sevi', 'Eine sanfte Idee von Sevi')}
    >
      <View style={{ gap: t.spacing.s3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          {/* Provenance chip (house idiom): this proposal is code's, deterministic — never AI. */}
          <Badge tone="neutral" size="sm">
            {pick('Sevi proposal', 'Sevi-Vorschlag')}
          </Badge>
        </View>
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, lineHeight: 20 }}>
          {applied
            ? pick(
                'Done — today is a bit lighter now.',
                'Erledigt — heute ist jetzt etwas leichter.',
              )
            : pick(
                `Today feels heavy. Shorten “${proposal.blockLabel}” by ${String(proposal.byMin)} min?`,
                `Heute fühlt sich schwer an. „${proposal.blockLabel}“ um ${String(proposal.byMin)} Min. kürzen?`,
              )}
        </Text>
        {!applied && (
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            <Button size="sm" disabled={busy} onPress={() => void confirm()}>
              {pick('Make today lighter', 'Heute leichter machen')}
            </Button>
            <Button size="sm" variant="ghost" onPress={dismiss}>
              {pick('Not today', 'Heute nicht')}
            </Button>
          </View>
        )}
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          {applied
            ? pick('You confirmed this change.', 'Du hast diese Änderung bestätigt.')
            : pick(
                'Nothing changes until you confirm.',
                'Nichts ändert sich, bis du bestätigst.',
              )}
        </Text>
      </View>
    </Card>
  )
}
