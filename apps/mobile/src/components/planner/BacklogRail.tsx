import { useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import {
  freeWindows,
  packWeek,
  type MinuteWindow,
  type PackInput,
  type PackResult,
} from '@mydevtime/domain'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { pick } from '../../i18n/strings.js'
import { apiBaseUrl } from '../../config.js'
import { applyPlanProposal, getProtectedTimes, type ProtectedTime } from '../../api/planApply.js'
import { getPlan, type DayPlan } from '../../api/planner.js'
import type { EstimateProposal } from '../../api/estimate.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useBacklogRail, type BacklogRailItem } from '../../hooks/useBacklogRail.js'
import { useWeekOccurrences } from '../../hooks/useWeekOccurrences.js'
import type { Occurrence } from '../../api/recurrence.js'
import { FillWeekPreview, type FillWeekGhost } from './FillWeekPreview'

/**
 * The backlog rail + "Fülle meine Woche" (REQ-073, ADR-0072 D2). Two parts:
 *
 * - {@link BacklogRail} — the presentational rail: imported issues + own tasks as one
 *   priority-sorted queue, each row at its **estimate height**, searchable. Unestimated
 *   items visibly carry the deterministic 60-minute default; an AI refinement (REQ-041)
 *   appears ONLY as a violet proposal chip (provenance `ai-proposal`) with its own accept —
 *   a `deterministic` degrade is shown neutrally, never dressed as AI (ADR-0005/0029).
 *
 * - {@link PlannerBacklogRail} — the self-contained container the PlannerScreen mounts: a
 *   **closed-by-default** chip (ux-vision §2.7 — the rail is a layer, one tap away) that
 *   opens the rail, computes the pure `PackInput` from the real feeds (recurring
 *   occurrences, 🛡 windows, the day's persisted plan → `freeWindows`; capacity line =
 *   8-hour target − life/🛡 commitments − already-planned minutes), runs `packWeek`, shows
 *   the result in {@link FillWeekPreview} and books it with ONE confirm through the
 *   plan-apply seam — one `add-blocks` proposal per affected day, provenance
 *   `planner-fill`. Dismiss drops the preview and writes nothing.
 *
 * **Placement path note (documented deviation):** "drag one onto the canvas" is not
 * trivially reusable here — the week canvas is FullCalendar on web and a PanResponder
 * canvas on native (both owned by the calm-canvas slice, #341), and its local demo-block
 * drag path does not persist through the seam. The rail therefore ships the honest
 * **tap-to-place fallback**: "Einplanen" on a row packs exactly that one item through the
 * same deterministic core + preview + confirm seam. Canvas drag-in lands with #341's
 * redesign.
 *
 * Until that redesign draws the accepted plan on the canvas, the container also renders a
 * compact **persisted read-back** ("Geplant") of each day's stored plan blocks — read from
 * `GET /api/planner/plans`, so what it shows is exactly what survived, reload-stable.
 */

/** The planner's day frame (08:00–18:00), matching `usePlanner`. */
const DAY_START_MIN = 8 * 60
const DAY_END_MIN = 18 * 60
/** The contracted daily target the capacity line starts from (REQ-055 default). */
const TARGET_DAILY_MIN = 8 * 60

/** `HH:MM` from a minute-of-day. */
function clock(minOfDay: number): string {
  const h = String(Math.floor(minOfDay / 60)).padStart(2, '0')
  const m = String(minOfDay % 60).padStart(2, '0')
  return `${h}:${m}`
}

/** Deterministic short label for a `YYYY-MM-DD` day key: `21.07.` */
function dayLabelOf(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`
}

/** Row height from the estimate — the rail's "estimate height" (60 min ≈ 44 px, clamped). */
function estimateHeight(estimateMin: number): number {
  return Math.max(36, Math.min(160, Math.round((estimateMin / 60) * 44)))
}

/**
 * The pure `PackInput` days from the real feeds. Windows are the free slots after every
 * obstacle (meetings/focus/life/travel occurrences, 🛡 windows, the day's persisted plan
 * blocks); the capacity line is the daily target minus life/🛡 commitments minus what the
 * stored plan already holds — remaining capacity, never stretched (stretching is #339's
 * repair deal).
 */
export function buildPackDays(
  weekDates: readonly string[],
  occurrences: readonly Occurrence[],
  protectedByDay: readonly (readonly ProtectedTime[])[],
  planByDay: readonly (DayPlan | null)[],
): PackInput['days'] {
  const coverage = (obstacles: readonly MinuteWindow[]): number =>
    DAY_END_MIN -
    DAY_START_MIN -
    freeWindows(DAY_START_MIN, DAY_END_MIN, obstacles).reduce(
      (sum, win) => sum + win.endMin - win.startMin,
      0,
    )
  return weekDates.map((day, i) => {
    const dayOccurrences = occurrences.filter(o => o.date === day)
    const shields = (protectedByDay[i] ?? []).map(p => ({
      startMin: p.startMin,
      endMin: p.endMin,
    }))
    const planBlocks = planByDay[i]?.blocks ?? []
    const obstacles: MinuteWindow[] = [
      ...dayOccurrences.map(o => ({ startMin: o.startMin, endMin: o.startMin + o.lenMin })),
      ...shields,
      ...planBlocks.map(b => ({ startMin: b.startMin, endMin: b.startMin + b.lenMin })),
    ]
    const commitments: MinuteWindow[] = [
      ...dayOccurrences
        .filter(o => o.kind === 'life')
        .map(o => ({ startMin: o.startMin, endMin: o.startMin + o.lenMin })),
      ...shields,
    ]
    const plannedMin = planBlocks.reduce((sum, b) => sum + b.lenMin, 0)
    return {
      day,
      windows: freeWindows(DAY_START_MIN, DAY_END_MIN, obstacles),
      capacityLineMin: Math.max(0, TARGET_DAILY_MIN - coverage(commitments) - plannedMin),
    }
  })
}

// ─── Presentational rail ───────────────────────────────────────────────────────────────────

export interface BacklogRailProps {
  readonly items: readonly BacklogRailItem[]
  readonly proposals: Readonly<Record<string, EstimateProposal>>
  readonly refining: readonly string[]
  readonly live: boolean
  readonly onRequestRefinement: (item: BacklogRailItem) => void
  readonly onAcceptRefinement: (item: BacklogRailItem) => void
  readonly onPlaceOne: (item: BacklogRailItem) => void
  readonly onFillWeek: () => void
}

function RailRow({
  item,
  proposal,
  refining,
  live,
  onRequestRefinement,
  onAcceptRefinement,
  onPlaceOne,
}: {
  readonly item: BacklogRailItem
  readonly proposal: EstimateProposal | undefined
  readonly refining: boolean
  readonly live: boolean
  readonly onRequestRefinement: () => void
  readonly onAcceptRefinement: () => void
  readonly onPlaceOne: () => void
}): React.JSX.Element {
  const t = useTheme()
  const isAi = proposal !== undefined && proposal.source === 'ai-proposal'
  return (
    <View
      accessibilityLabel={`${pick('Backlog item', 'Backlog-Eintrag')}: ${item.title}`}
      style={{
        minHeight: estimateHeight(item.estimateMin),
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: t.spacing.s3,
        borderRadius: t.radius.block,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.raised,
      }}
    >
      <Text
        numberOfLines={2}
        style={{ fontSize: t.fontSize.xs, fontWeight: '600', color: t.color.ink }}
      >
        {item.title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text
          style={{
            fontFamily: t.fontFamily.numeric,
            fontSize: t.fontSize['2xs'],
            color: t.color.ink2,
          }}
        >
          {`${formatDuration(item.estimateMin * 60_000)} h`}
        </Text>
        {item.estimateSource === 'default' && (
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            {pick('default 60 min', 'Standard 60 min')}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {item.estimateSource === 'default' && proposal === undefined && (
          <Pressable
            onPress={onRequestRefinement}
            disabled={refining || !live}
            accessibilityRole="button"
            accessibilityLabel={`${pick('AI estimate for', 'KI-Schätzung für')} ${item.title}`}
          >
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.aiInk }}>
              {refining ? pick('estimating…', 'schätzt…') : '✦ AI'}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onPlaceOne}
          accessibilityRole="button"
          accessibilityLabel={`${pick('Place', 'Einplanen')}: ${item.title}`}
        >
          <Text
            style={{ fontSize: t.fontSize['2xs'], fontWeight: '700', color: t.color.accentText }}
          >
            {pick('Place', 'Einplanen')}
          </Text>
        </Pressable>
      </View>
      {proposal !== undefined && (
        // The refinement, honestly attributed: violet ONLY when the AI really proposed
        // (`ai-proposal`); the free deterministic degrade is neutral (ADR-0005/0029).
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            paddingVertical: 4,
            paddingHorizontal: t.spacing.s2,
            borderRadius: t.radius.block,
            borderWidth: 1,
            borderColor: isAi ? t.color.aiInk : t.color.border,
            backgroundColor: isAi ? t.color.aiSoft : t.color.surface,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: t.fontSize['2xs'],
              fontWeight: '600',
              color: isAi ? t.color.aiInk : t.color.ink2,
            }}
          >
            {`${isAi ? pick('AI proposal', 'KI-Vorschlag') : pick('Baseline', 'Baseline')}: ${formatDuration(proposal.estimateMinutes * 60_000)} h`}
          </Text>
          <Pressable
            onPress={onAcceptRefinement}
            accessibilityRole="button"
            accessibilityLabel={`${pick('Apply estimate for', 'Schätzung übernehmen für')} ${item.title}`}
          >
            <Text
              style={{
                fontSize: t.fontSize['2xs'],
                fontWeight: '700',
                color: isAi ? t.color.aiInk : t.color.ink,
              }}
            >
              {pick('Apply', 'Übernehmen')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export function BacklogRail({
  items,
  proposals,
  refining,
  live,
  onRequestRefinement,
  onAcceptRefinement,
  onPlaceOne,
  onFillWeek,
}: BacklogRailProps): React.JSX.Element {
  const t = useTheme()
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const shown = needle === '' ? items : items.filter(i => i.title.toLowerCase().includes(needle))

  return (
    <View
      accessibilityLabel={pick('Backlog rail', 'Backlog-Leiste')}
      style={{
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text style={{ flex: 1, fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
          {pick('Backlog', 'Backlog')}
        </Text>
        <Button size="sm" disabled={items.length === 0} onPress={onFillWeek}>
          {pick('Fill my week', 'Fülle meine Woche')}
        </Button>
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={pick('Search backlog…', 'Backlog durchsuchen…')}
        placeholderTextColor={t.color.ink3}
        accessibilityLabel={pick('Search backlog', 'Backlog durchsuchen')}
        style={{
          paddingVertical: 6,
          paddingHorizontal: t.spacing.s3,
          borderRadius: t.radius.block,
          borderWidth: 1,
          borderColor: t.color.border,
          color: t.color.ink,
          fontSize: t.fontSize.xs,
        }}
      />
      {shown.length === 0 ? (
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          {items.length === 0
            ? pick(
                'No open tickets — imported issues and open tasks land here.',
                'Keine offenen Tickets — importierte Issues und offene Aufgaben landen hier.',
              )
            : pick('No match.', 'Kein Treffer.')}
        </Text>
      ) : (
        <View style={{ gap: t.spacing.s2 }}>
          {shown.map(item => (
            <RailRow
              key={item.id}
              item={item}
              proposal={proposals[item.id]}
              refining={refining.includes(item.id)}
              live={live}
              onRequestRefinement={() => {
                onRequestRefinement(item)
              }}
              onAcceptRefinement={() => {
                onAcceptRefinement(item)
              }}
              onPlaceOne={() => {
                onPlaceOne(item)
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Self-contained container (the PlannerScreen mounts exactly this) ──────────────────────

interface PreviewState {
  readonly result: PackResult
  readonly items: readonly BacklogRailItem[]
}

export interface PlannerBacklogRailProps {
  /** The shown week's `YYYY-MM-DD` day columns, in order (the Planner's `weekDates`). */
  readonly weekDates: readonly string[]
}

export function PlannerBacklogRail({ weekDates }: PlannerBacklogRailProps): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const rail = useBacklogRail()
  const occurrences = useWeekOccurrences(weekDates)
  const weekKey = weekDates.join('|')

  const plans = useAsync<(DayPlan | null)[]>(
    () =>
      base !== null
        ? Promise.all(weekDates.map(d => getPlan(base, d)))
        : Promise.resolve(weekDates.map(() => null)),
    `fill-week-plans:${base ?? 'off'}:${weekKey}`,
  )
  const shields = useAsync<ProtectedTime[][]>(
    () =>
      base !== null
        ? Promise.all(weekDates.map(d => getProtectedTimes(base, d).then(p => [...p])))
        : Promise.resolve(weekDates.map(() => [])),
    `fill-week-protected:${base ?? 'off'}:${weekKey}`,
  )

  // The rail is a layer — closed by default, one tap away (ux-vision §2.7).
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const packInto = (items: readonly BacklogRailItem[]): void => {
    const days = buildPackDays(
      weekDates,
      occurrences.data ?? [],
      shields.data ?? weekDates.map(() => []),
      plans.data ?? weekDates.map(() => null),
    )
    const input: PackInput = {
      weekStartDay: weekDates[0] ?? '',
      days,
      items: items.map(i => ({
        id: i.id,
        title: i.title,
        estimateMin: i.estimateMin,
        priority: i.priority,
        ...(i.projectId === undefined ? {} : { projectId: i.projectId }),
      })),
    }
    setPreview({ result: packWeek(input), items })
    setError(null)
  }

  const confirm = (): void => {
    if (preview === null || base === null || busy) return
    const titleOf = new Map(preview.items.map(i => [i.id, i]))
    const byDay = new Map<
      string,
      { startMin: number; lenMin: number; kind: 'focus'; label: string; taskId?: string }[]
    >()
    for (const p of preview.result.placements) {
      const item = titleOf.get(p.itemId)
      const block = {
        startMin: p.startMin,
        lenMin: p.lenMin,
        kind: 'focus' as const,
        label: item?.title ?? p.itemId,
        ...(item?.taskId === undefined ? {} : { taskId: item.taskId }),
      }
      byDay.set(p.day, [...(byDay.get(p.day) ?? []), block])
    }
    if (byDay.size === 0) return
    setBusy(true)
    // ONE confirm → one `add-blocks` per affected day through the ONE plan-apply seam,
    // provenance `planner-fill` (ADR-0071/0072). Sequential on purpose: each day's write is
    // its own new accepted plan version.
    void (async () => {
      try {
        for (const [day, blocks] of byDay) {
          await applyPlanProposal(base, {
            kind: 'add-blocks',
            day,
            blocks,
            provenance: 'planner-fill',
          })
        }
        setPreview(null)
        plans.reload()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setBusy(false)
      }
    })()
  }

  // Dismiss is a NO-OP beyond dropping the preview — nothing posted, nothing stored.
  const dismiss = (): void => {
    setPreview(null)
  }

  const ghosts: FillWeekGhost[] =
    preview === null
      ? []
      : preview.result.placements.map(p => ({
          day: p.day,
          dayLabel: dayLabelOf(p.day),
          startMin: p.startMin,
          lenMin: p.lenMin,
          title: preview.items.find(i => i.id === p.itemId)?.title ?? p.itemId,
        }))

  // Persisted read-back: the stored plans' blocks — exactly what GET /api/planner/plans
  // returns, so this list is reload-stable proof of what the confirm actually booked.
  const persisted = (plans.data ?? []).flatMap((plan, i) =>
    (plan?.blocks ?? []).map(b => ({
      day: weekDates[i] ?? plan?.date ?? '',
      startMin: b.startMin,
      lenMin: b.lenMin,
      label: b.label,
    })),
  )

  return (
    <View style={{ gap: t.spacing.s3 }}>
      <Pressable
        onPress={() => {
          setOpen(o => !o)
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={pick('Backlog rail', 'Backlog-Leiste')}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: open ? t.color.accent : t.color.border,
          backgroundColor: open ? t.color.accentSoft : t.color.surface,
        }}
      >
        <Text
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '600',
            color: open ? t.color.accentText : t.color.ink2,
          }}
        >
          {`▤ Backlog${rail.items.length > 0 ? ` · ${String(rail.items.length)}` : ''}`}
        </Text>
      </Pressable>

      {open && (
        <BacklogRail
          items={rail.items}
          proposals={rail.proposals}
          refining={rail.refining}
          live={rail.live}
          onRequestRefinement={rail.requestRefinement}
          onAcceptRefinement={item => {
            rail.acceptRefinement(item)
            // An accepted refinement changes the input → an open preview re-packs on the
            // next fill; a stale ghost week must not survive the accept.
            setPreview(null)
          }}
          onPlaceOne={item => {
            packInto([item])
          }}
          onFillWeek={() => {
            packInto(rail.items)
          }}
        />
      )}

      {open && preview !== null && (
        <FillWeekPreview
          ghosts={ghosts}
          unplacedCount={preview.result.unplaced.length}
          busy={busy}
          onConfirm={confirm}
          onDismiss={dismiss}
        />
      )}

      {open && error !== null && (
        <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
          {pick('Booking failed — ', 'Buchung fehlgeschlagen — ') + error}
        </Text>
      )}

      {open && persisted.length > 0 && (
        <View
          accessibilityLabel={pick('Planned blocks', 'Geplante Blöcke')}
          style={{
            gap: t.spacing.s1,
            padding: t.spacing.s3,
            borderRadius: t.radius.card,
            borderWidth: 1,
            borderColor: t.color.border,
          }}
        >
          <Text style={{ fontSize: t.fontSize['2xs'], fontWeight: '700', color: t.color.ink2 }}>
            {pick('Planned', 'Geplant')}
          </Text>
          {persisted.map((row, i) => (
            <Text
              key={`${row.day}-${String(row.startMin)}-${String(i)}`}
              style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}
            >
              {`${dayLabelOf(row.day)} ${clock(row.startMin)}–${clock(row.startMin + row.lenMin)} · ${row.label}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}
