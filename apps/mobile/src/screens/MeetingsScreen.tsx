import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import { projectColor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, EmptyState, ScreenScaffold } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Meetings — transcript list + AI insights (ux-vision §3, #32/#33). Consent-first
 * by construction (REQ-025): a meeting only appears once recording was opted into,
 * and that is surfaced on the row. Every figure in a summary comes from the
 * deterministic core, never the model (ADR-0005); AI actions cost a credit and
 * only *propose* — a task/Jira/Slack item is created after confirmation, never
 * automatically.
 */
type MeetingState = 'insights' | 'transcript' | 'upcoming'

interface Meeting {
  readonly id: string
  readonly title: string
  readonly project: string
  readonly time: string
  readonly duration: string
  readonly state: MeetingState
  readonly summary?: readonly string[]
  readonly actions?: readonly string[]
}

function stateBadge(state: MeetingState): { tone: 'good' | 'neutral' | 'warn'; label: string } {
  if (state === 'insights') return { tone: 'good', label: 'Insights ✓' }
  if (state === 'transcript') return { tone: 'neutral', label: 'Transcript' }
  return { tone: 'warn', label: 'Recording opted in' }
}

export function MeetingsScreen(): React.JSX.Element {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const stacked = width < 760
  const meetings: readonly Meeting[] = []
  const [selId, setSelId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const sel = meetings.find(m => m.id === selId) ?? meetings[0]

  const header = (
    <View>
      <Text
        style={{
          fontWeight: '700',
          fontSize: t.fontSize.xl,
          color: t.color.ink,
          fontFamily: t.fontFamily.display,
        }}
      >
        Meetings
      </Text>
      <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
        Transcripts & AI insights · consent-first
      </Text>
    </View>
  )

  if (sel === undefined) {
    return (
      <ScreenScaffold header={header}>
        <EmptyState
          title="No meetings yet"
          hint="Opt a meeting into recording and its transcript and AI insights show up here. Consent-first by design — every figure comes from the deterministic core, never the model."
        />
      </ScreenScaffold>
    )
  }

  const list = (
    <Card title="This week" {...(stacked ? {} : { style: { width: 280 } })}>
      <View style={{ gap: t.spacing.s1 }}>
        {meetings.map(m => {
          const active = m.id === selId
          const badge = stateBadge(m.state)
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                setSelId(m.id)
                setNote(null)
              }}
              style={{
                padding: t.spacing.s3,
                borderRadius: t.radius.chip,
                backgroundColor: active ? t.color.bg : 'transparent',
                borderWidth: 1,
                borderColor: active ? t.color.border : 'transparent',
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: projectColor(m.project, t.mode),
                  }}
                />
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, fontWeight: '600' }}>
                  {m.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <Text
                  style={{
                    fontSize: t.fontSize['2xs'],
                    color: t.color.ink2,
                    fontFamily: t.fontFamily.numeric,
                  }}
                >
                  {m.time} · {m.duration}
                </Text>
                <Badge tone={badge.tone} size="sm">
                  {badge.label}
                </Badge>
              </View>
            </Pressable>
          )
        })}
      </View>
    </Card>
  )

  const detail = (
    <View style={{ flex: stacked ? undefined : 1, gap: t.spacing.s4 }}>
      <Card
        title={sel.title}
        subtitle={`${sel.time} · ${sel.duration}`}
        action={sel.state !== 'upcoming' ? <Badge tone="good">Transcript · de</Badge> : undefined}
      >
        {sel.state === 'insights' && (
          <View style={{ gap: t.spacing.s4 }}>
            <Section title="Summary" credit>
              <View style={{ gap: t.spacing.s2 }}>
                {sel.summary?.map(s => (
                  <View key={s} style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                    <Text style={{ color: t.color.accent }}>•</Text>
                    <Text style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.ink2 }}>
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>

            <Section title="Action items">
              <View style={{ gap: t.spacing.s2 }}>
                {sel.actions?.map(a => (
                  <View
                    key={a}
                    style={{
                      flexDirection: stacked ? 'column' : 'row',
                      alignItems: stacked ? 'flex-start' : 'center',
                      gap: t.spacing.s2,
                      padding: t.spacing.s3,
                      borderRadius: t.radius.chip,
                      backgroundColor: t.color.bg,
                      borderWidth: 1,
                      borderColor: t.color.border,
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: t.fontSize.sm, color: t.color.ink }}>
                      {a}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
                      {(['Task', 'Jira', 'GitHub', 'Slack'] as const).map(target => (
                        <Button
                          key={target}
                          size="sm"
                          variant="ghost"
                          onPress={() =>
                            setNote(
                              `Creates a ${target} item from a preview payload — after you confirm, never automatically.`,
                            )
                          }
                        >
                          {`→ ${target}`}
                        </Button>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </Section>

            <Section title="Custom prompts">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
                {['Draft follow-up email', 'Extract scope changes', 'List decisions'].map(p => (
                  <Pressable
                    key={p}
                    onPress={() => setNote(`Prompt “${p}” would cost 1 AI credit.`)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: t.spacing.s3,
                      borderRadius: t.radius.pill,
                      borderWidth: 1,
                      borderColor: t.color.border,
                      backgroundColor: t.color.bg,
                    }}
                  >
                    <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>✦ {p}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
              Every figure comes from the deterministic core — never the model. The transcript is
              your data: export and deletion included.
            </Text>
          </View>
        )}

        {sel.state === 'transcript' && (
          <View style={{ gap: t.spacing.s3 }}>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
              Transcript ready — no insights generated yet.
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <Button
                size="sm"
                onPress={() => setNote('Summarizing would cost 1 AI credit (demo).')}
              >
                ✦ Summarize · 1 credit
              </Button>
            </View>
          </View>
        )}

        {sel.state === 'upcoming' && (
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, lineHeight: 20 }}>
            Starts at 15:00. Recording consent is granted (revocable per meeting) — the bot joins
            visibly and every participant sees the recording status.
          </Text>
        )}
      </Card>

      {note !== null && (
        <Card>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>{note}</Text>
        </Card>
      )}
    </View>
  )

  return (
    <ScreenScaffold header={header}>
      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: t.spacing.s5,
          alignItems: 'flex-start',
        }}
      >
        {list}
        {detail}
      </View>
    </ScreenScaffold>
  )
}

function Section({
  title,
  credit,
  children,
}: {
  title: string
  credit?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={{ gap: t.spacing.s2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text
          style={{
            fontSize: t.fontSize['2xs'],
            fontWeight: '700',
            color: t.color.ink2,
            textTransform: 'uppercase',
            letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
          }}
        >
          {title}
        </Text>
        {credit ? (
          <Badge tone="accent" size="sm">
            AI · 1 credit
          </Badge>
        ) : null}
      </View>
      {children}
    </View>
  )
}
