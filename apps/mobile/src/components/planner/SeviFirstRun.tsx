import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { applyPlanProposal } from '../../api/planApply'
import { apiBaseUrl } from '../../config'
import { firstRunGhostWeek, firstRunPlannableDates, type FirstRunDay } from '../../planner/firstRun'
import { Text } from '../core/Text'
import { Button, Card, Input, Sevi } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Sevi's first-run stage (ADR-0072 D3, REQ-074, issue #341): a truly empty
 * planner is not a dead wall — Sevi asks three questions and lays the answers out
 * as the **first ghost week**, built by the pure `firstRunGhostWeek` (ADR-0005:
 * deterministic, no LLM, zero demo data). One tap applies every day through the
 * plan-apply seam (`add-blocks`, provenance `planner-firstrun` — ADR-0071:
 * confirm-only, a new accepted version per day, nothing books without the tap).
 * Skippable; the parent persists the seen/accepted flag so the stage never
 * returns after a first accepted plan.
 */
export interface SeviFirstRunProps {
  /** The shown week's `YYYY-MM-DD` day keys, Monday first. */
  readonly weekDates: readonly string[]
  /** Today's `YYYY-MM-DD` key — the never-plan-the-past boundary. */
  readonly todayKey: string
  /** The ghost week was applied through the seam — reload plans, persist the flag. */
  readonly onAccepted: () => void
  /** The user skipped — persist the seen flag; the stage never nags again. */
  readonly onSkip: () => void
}

const START_CHOICES = [
  { label: '07:00', min: 420 },
  { label: '08:00', min: 480 },
  { label: '09:00', min: 540 },
  { label: '10:00', min: 600 },
] as const

const END_CHOICES = [
  { label: '16:00', min: 960 },
  { label: '17:00', min: 1020 },
  { label: '18:00', min: 1080 },
] as const

/** `YYYY-MM-DD` + n days, in UTC — pure date-key arithmetic for the next-week fallback. */
function plusDays(dateKey: string, days: number): string {
  const at = new Date(`${dateKey}T00:00:00.000Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

function ChoiceRow({
  label,
  choices,
  activeMin,
  onPick,
}: {
  readonly label: string
  readonly choices: readonly { readonly label: string; readonly min: number }[]
  readonly activeMin: number
  readonly onPick: (min: number) => void
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
        {choices.map(c => {
          const on = c.min === activeMin
          return (
            <Pressable
              key={c.label}
              onPress={() => onPick(c.min)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${c.label}`}
              style={{
                paddingVertical: 6,
                paddingHorizontal: t.spacing.s3,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: on ? t.color.accent : t.color.border,
                backgroundColor: on ? t.color.accentSoft : t.color.surface,
              }}
            >
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.xs,
                  fontWeight: '700',
                  color: on ? t.color.accentText : t.color.ink2,
                }}
              >
                {c.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function SeviFirstRun({
  weekDates,
  todayKey,
  onAccepted,
  onSkip,
}: SeviFirstRunProps): React.JSX.Element {
  const t = useTheme()
  const [startMin, setStartMin] = useState(540)
  const [endMin, setEndMin] = useState(1020)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // This week's not-yet-past weekdays; on a weekend the proposal moves honestly
  // to next week's Mon–Fri instead of pretending the past is plannable.
  const thisWeek = firstRunPlannableDates(weekDates, todayKey)
  const planThisWeek = thisWeek.length > 0
  const dates = planThisWeek ? thisWeek : weekDates.slice(0, 5).map(d => plusDays(d, 7))
  const ghostWeek: readonly FirstRunDay[] = firstRunGhostWeek({ startMin, topic, endMin }, dates)
  const focusPerDay = ghostWeek[0]?.blocks.filter(b => b.kind === 'focus').length ?? 0

  const accept = (): void => {
    const base = apiBaseUrl
    if (base === null || ghostWeek.length === 0 || busy) return
    setBusy(true)
    setError(null)
    void (async () => {
      // One confirmed tap = one `add-blocks` per planned day, all carrying the
      // `planner-firstrun` provenance; an empty day starts at version 1 (accepted).
      for (const day of ghostWeek) {
        await applyPlanProposal(base, {
          kind: 'add-blocks',
          day: day.date,
          blocks: day.blocks.map(b => ({
            startMin: b.startMin,
            lenMin: b.lenMin,
            kind: b.kind,
            label: b.label,
          })),
          provenance: 'planner-firstrun',
        })
      }
    })()
      .then(() => onAccepted())
      .catch(() => {
        setError('Das hat nicht geklappt — dein Plan wurde nicht gespeichert. Versuch es nochmal.')
        setBusy(false)
      })
  }

  return (
    <Card>
      <View style={{ gap: t.spacing.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
          <Sevi mood="focus" size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: t.fontFamily.display,
                fontSize: t.fontSize.md,
                fontWeight: '700',
                color: t.color.ink,
              }}
            >
              Deine Woche ist noch leer.
            </Text>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
              Drei Antworten, und ich schlage dir eine erste Woche vor — als Ghost-Blöcke. Gebucht
              wird nur, was du übernimmst.
            </Text>
          </View>
        </View>

        <ChoiceRow
          label="Wann fängst du an?"
          choices={START_CHOICES}
          activeMin={startMin}
          onPick={setStartMin}
        />
        <Input
          label="Woran arbeitest du diese Woche?"
          value={topic}
          onChangeText={setTopic}
          placeholder="z. B. Sync-Engine"
        />
        <ChoiceRow
          label="Wann ist Feierabend?"
          choices={END_CHOICES}
          activeMin={endMin}
          onPick={setEndMin}
        />

        {ghostWeek.length > 0 && (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {`Vorschlag: ${String(ghostWeek.length)} ${ghostWeek.length === 1 ? 'Tag' : 'Tage'}${
              planThisWeek ? '' : ' (nächste Woche)'
            } · je ${String(focusPerDay)}× Fokus mit Pausen · alles als Vorschlag, nichts gebucht.`}
          </Text>
        )}
        {error !== null && (
          <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
            {error}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || ghostWeek.length === 0}
            onPress={accept}
          >
            {busy ? '…' : planThisWeek ? 'Woche übernehmen' : 'Nächste Woche übernehmen'}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onPress={onSkip}>
            Überspringen
          </Button>
        </View>
      </View>
    </Card>
  )
}
