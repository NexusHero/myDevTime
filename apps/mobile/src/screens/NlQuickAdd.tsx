import { useState } from 'react'
import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { apiBaseUrl } from '../config'
import { useCatalog } from './useCatalog'
import {
  catalogVocabulary,
  createEntry,
  draftToEntryTimes,
  fetchNlDraft,
  resolveProjectId,
  type NlDraft,
} from '../api/nlEntry'

/**
 * Natural-language quick-add (REQ-013, ADR-0005): type "2h Finanzo review gestern",
 * the `ai` module parses it into a **draft**, and only on confirm does it create a
 * real entry (deterministic parser first, LLM only as fallback — ADR-0029). The
 * draft is always shown for review; nothing is written silently. Needs the backend
 * — offline it shows a hint instead of a demo, since capture must be real.
 */
type Phase = 'idle' | 'preview' | 'done'

export function NlQuickAdd(): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const catalog = useCatalog()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<NlDraft | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const projectId = draft ? resolveProjectId(catalog.data ?? [], draft.projectHint) : null
  const projectName =
    (catalog.data ?? []).flatMap(c => c.projects).find(p => p.id === projectId)?.name ?? null

  const parse = (): void => {
    if (base === null || text.trim().length === 0) return
    setBusy(true)
    setError(null)
    fetchNlDraft(base, text.trim(), catalogVocabulary(catalog.data ?? []))
      .then(result => {
        if (result.draft === null) {
          setError('Couldn’t read that — try e.g. “2h Finanzo review”.')
          setPhase('idle')
          return
        }
        setDraft(result.draft)
        setNote(result.draft.note ?? '')
        setPhase('preview')
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const confirm = (): void => {
    if (base === null || draft === null) return
    setBusy(true)
    const { startedAt, endedAt } = draftToEntryTimes(draft, new Date())
    createEntry(base, {
      startedAt,
      endedAt,
      projectId,
      note: note.trim() || null,
      billable: draft.billable,
    })
      .then(() => {
        setPhase('done')
        setText('')
        setDraft(null)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text style={{ fontSize: t.fontSize.md, fontWeight: '700', color: t.color.ink, flex: 1 }}>
          Quick add
        </Text>
        {base === null && <Badge tone="neutral">Needs backend</Badge>}
      </View>
      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
        Natural language, e.g. “2h Finanzo review gestern”
      </Text>

      <View style={{ marginTop: t.spacing.s3 }}>
        <Input
          value={text}
          onChangeText={v => {
            setText(v)
            if (phase !== 'idle') setPhase('idle')
          }}
          placeholder="2h Finanzo review gestern"
        />
      </View>

      {phase === 'preview' && draft && (
        <View
          style={{
            marginTop: t.spacing.s3,
            padding: t.spacing.s3,
            borderRadius: t.radius.chip,
            backgroundColor: t.color.raised,
            gap: t.spacing.s2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
            <Text
              style={{
                fontFamily: t.fontFamily.numeric,
                fontSize: t.fontSize.md,
                fontWeight: '700',
                color: t.color.ink,
              }}
            >
              {formatDuration(draft.durationMs)} h
            </Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
              {projectName ?? draft.projectHint ?? 'No project'}
              {draft.dayOffset === -1 ? ' · yesterday' : ' · today'}
            </Text>
            {!draft.billable && <Badge tone="neutral">Non-billable</Badge>}
          </View>
          {draft.projectHint && projectName === null && (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.warn }}>
              No project matches “{draft.projectHint}” — it’ll be added without one.
            </Text>
          )}
          <Input value={note} onChangeText={setNote} placeholder="Note" />
        </View>
      )}

      {error && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.crit }}>
          {error}
        </Text>
      )}
      {phase === 'done' && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.good }}>
          Entry added.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        {phase === 'preview' ? (
          <Button size="sm" disabled={busy} onPress={confirm}>
            Add entry
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || base === null || text.trim().length === 0}
            onPress={parse}
          >
            Parse
          </Button>
        )}
      </View>
    </Card>
  )
}
