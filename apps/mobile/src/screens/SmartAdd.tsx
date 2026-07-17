import { useState } from 'react'
import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import type { SmartEntryDraft, SmartEntryKind } from '@mydevtime/domain'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { apiBaseUrl } from '../config'
import { useCatalog } from './useCatalog'
import { catalogVocabulary, createEntry, resolveProjectId } from '../api/nlEntry'
import { fetchSmartAdd, smartDraftToEntryTimes, type SmartAddSource } from '../api/smartAdd'

/**
 * The smart Plus (REQ-047, design v13 K6) — one field, one plus. A phrase is classified
 * by the deterministic `parseEntry` (Stage 1); a vague one falls to the grounded LLM
 * (Stage 2), and only then does the result wear the violet AI signature. The typed draft
 * is always shown as a correctable chip — nothing is written until the user confirms
 * (ADR-0005). Task/meeting/travel/private become a time entry here; an absence is routed
 * to the Absences screen (booked there, not silently). Needs the backend; offline it says
 * so rather than faking capture.
 */
type Phase = 'idle' | 'preview' | 'done'

const KIND_LABEL: Record<SmartEntryKind, string> = {
  task: 'Task',
  meeting: 'Meeting',
  absence: 'Absence',
  travel: 'Travel',
  private: 'Private',
}

/** These kinds map to a time entry; an absence is booked on its own screen. */
const ENTRY_KINDS: readonly SmartEntryKind[] = ['task', 'meeting', 'travel', 'private']

function dayLabel(dayOffset: number): string {
  if (dayOffset === 0) return 'today'
  if (dayOffset === -1) return 'yesterday'
  if (dayOffset === 1) return 'tomorrow'
  if (dayOffset >= 100) {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return names[(dayOffset - 100) % 7] ?? 'a day'
  }
  return `${dayOffset > 0 ? '+' : ''}${String(dayOffset)}d`
}

function timeLabel(draft: SmartEntryDraft): string {
  const hm = (min: number): string =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  if (draft.startMin !== null && draft.endMin !== null)
    return `${hm(draft.startMin)}–${hm(draft.endMin)}`
  if (draft.startMin !== null) return `from ${hm(draft.startMin)}`
  if (draft.durationMs !== null) return `${formatDuration(draft.durationMs)} h`
  return '1h'
}

export function SmartAdd(): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const catalog = useCatalog()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<SmartEntryDraft | null>(null)
  const [source, setSource] = useState<SmartAddSource>('deterministic')
  const [error, setError] = useState<string | null>(null)

  const projectId = draft ? resolveProjectId(catalog.data ?? [], draft.projectHint) : null
  const projectName =
    (catalog.data ?? []).flatMap(c => c.projects).find(p => p.id === projectId)?.name ?? null
  const isAi = source === 'ai-proposal'

  const parse = (): void => {
    if (base === null || text.trim().length === 0) return
    setBusy(true)
    setError(null)
    fetchSmartAdd(base, text.trim(), catalogVocabulary(catalog.data ?? []))
      .then(result => {
        setDraft(result.draft)
        setSource(result.source)
        setPhase('preview')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }

  const confirm = (): void => {
    if (base === null || draft === null) return
    if (!ENTRY_KINDS.includes(draft.kind)) return // absence is booked on the Absences screen
    setBusy(true)
    const { startedAt, endedAt } = smartDraftToEntryTimes(draft, new Date())
    createEntry(base, {
      startedAt,
      endedAt,
      projectId,
      note: draft.title || null,
      billable: draft.billable,
    })
      .then(() => {
        setPhase('done')
        setText('')
        setDraft(null)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text style={{ fontSize: t.fontSize.md, fontWeight: '700', color: t.color.ink, flex: 1 }}>
          Add anything
        </Text>
        {base === null && <Badge tone="neutral">Needs backend</Badge>}
      </View>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
        One field: “standup 9:00–9:15”, “PROJ-12 fix login 2h”, “vacation friday”, “drive to client”
      </Text>

      <View style={{ marginTop: t.spacing.s3 }}>
        <Input
          value={text}
          onChangeText={v => {
            setText(v)
            if (phase !== 'idle') setPhase('idle')
          }}
          placeholder="Type an entry…"
        />
      </View>

      {phase === 'preview' && draft && (
        <View
          style={{
            marginTop: t.spacing.s3,
            padding: t.spacing.s3,
            borderRadius: t.radius.chip,
            backgroundColor: isAi ? t.color.aiSoft : t.color.raised,
            borderWidth: isAi ? 1 : 0,
            borderColor: isAi ? t.color.aiInk : 'transparent',
            gap: t.spacing.s2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              flexWrap: 'wrap',
            }}
          >
            <Badge tone={draft.kind === 'absence' ? 'warn' : 'neutral'}>
              {KIND_LABEL[draft.kind]}
            </Badge>
            <Text
              style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink, flex: 1 }}
            >
              {draft.title || '—'}
            </Text>
            {isAi && (
              <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.aiInk }}>
                ✦ AI
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.sm,
                color: t.color.ink2,
              }}
            >
              {timeLabel(draft)} · {dayLabel(draft.dayOffset)}
            </Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
              {projectName ?? draft.projectHint ?? 'No project'}
            </Text>
            {!draft.billable && draft.kind !== 'absence' && (
              <Badge tone="neutral">Non-billable</Badge>
            )}
          </View>
          {draft.kind === 'absence' && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.warn }}>
              This is an absence — open Absences to book it.
            </Text>
          )}
          {draft.projectHint && projectName === null && draft.kind !== 'absence' && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.warn }}>
              No project matches “{draft.projectHint}” — it’ll be added without one.
            </Text>
          )}
        </View>
      )}

      {error && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.crit }}>
          {error}
        </Text>
      )}
      {phase === 'done' && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.good }}>
          Added.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        {phase === 'preview' && draft && ENTRY_KINDS.includes(draft.kind) ? (
          <Button size="sm" disabled={busy} onPress={confirm}>
            {`Add ${KIND_LABEL[draft.kind].toLowerCase()}`}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || base === null || text.trim().length === 0}
            onPress={parse}
          >
            Add
          </Button>
        )}
      </View>
    </Card>
  )
}
