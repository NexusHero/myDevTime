import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Button, EmptyState, Icon, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { apiBaseUrl } from '../config'
import { useReports } from '../hooks/useReports'
import { askAssistant, factsFromReports, type AssistantResult } from '../api/assistant'

/**
 * Assistant — the grounded, read-only helper (ux-vision §2.4, #20, M2). It answers
 * only from the workspace's own data: the client derives factual sentences from the
 * loaded Reports deterministically and sends them with the question; the LLM phrases
 * them, never invents a number, and refuses cleanly when the answer is not in the
 * facts (ADR-0005/0029). It proposes and never mutates state. One credit per AI
 * answer. Without a backend it falls back to a deterministic best-matching fact.
 */
interface ChatMsg {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly refusal?: boolean
  readonly source?: 'deterministic' | 'ai-proposal'
}

const EXAMPLES: readonly string[] = [
  'Was ist mein Top-Projekt diese Woche?',
  'Wie ist mein Überstundensaldo?',
  'Wie viel habe ich diese Woche abgerechnet?',
]

/** Deterministic offline answer: pick the fact with the most word-overlap. */
function offlineAnswer(question: string, facts: readonly string[]): AssistantResult {
  const qWords = new Set(
    question
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => w.length >= 3),
  )
  let best = ''
  let bestScore = 0
  for (const f of facts) {
    const score = f
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => qWords.has(w)).length
    if (score > bestScore) {
      bestScore = score
      best = f
    }
  }
  return bestScore > 0
    ? { source: 'deterministic', refused: false, charged: false, text: best }
    : {
        source: 'deterministic',
        refused: true,
        charged: false,
        text: 'Das steht nicht in deinen aktuellen Daten — frag konkreter.',
      }
}

export function AssistantScreen(): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const reports = useReports()
  const [msgs, setMsgs] = useState<readonly ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const send = (text: string): void => {
    if (!text.trim() || busy) return
    const facts = reports.data ? factsFromReports(reports.data) : []
    setMsgs(m => [...m, { role: 'user', text }])
    setInput('')
    const finish = (r: AssistantResult): void => {
      setMsgs(m => [
        ...m,
        { role: 'assistant', text: r.text, refusal: r.refused, source: r.source },
      ])
    }
    if (base === null) {
      finish(offlineAnswer(text, facts))
      return
    }
    setBusy(true)
    askAssistant(base, text, facts)
      .then(finish)
      .catch((cause: unknown) => {
        finish({
          source: 'deterministic',
          refused: true,
          charged: false,
          text: `Konnte nicht antworten — ${cause instanceof Error ? cause.message : String(cause)}`,
        })
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s3,
          gap: t.spacing.s3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3, flex: 1 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="assistant" size={20} color="#fff" />
          </View>
          <Text
            style={{
              fontWeight: '700',
              fontSize: t.fontSize.xl,
              color: t.color.ink,
              fontFamily: t.fontFamily.display,
              letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
            }}
          >
            Assistant
          </Text>
        </View>
        <Badge tone="neutral">deine Daten · nur Lesezugriff</Badge>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s4,
          gap: t.spacing.s3,
        }}
      >
        {msgs.length === 0 ? (
          <EmptyState
            title="Frag deine eigenen Daten"
            hint="Der Assistant antwortet nur aus deinen Zeiten, Projekten, Budgets und Meetings — jede Zahl kommt aus der deterministischen Aggregation, nie aus dem Modell. 1 Credit pro Frage."
          />
        ) : (
          msgs.map((m, i) => <Bubble key={`${m.role}-${String(i)}`} msg={m} />)
        )}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: t.color.border,
          backgroundColor: t.color.surface,
          padding: t.spacing.s4,
          gap: t.spacing.s3,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
          {EXAMPLES.map(s => (
            <Button key={s} size="sm" variant="ghost" onPress={() => send(s)}>
              {s}
            </Button>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.s2 }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Frag nach Zeiten, Budgets, Meetings … · 1 Credit"
              value={input}
              onChangeText={setInput}
            />
          </View>
          <Button onPress={() => send(input)}>Senden</Button>
        </View>
      </View>
    </View>
  )
}

function Bubble({ msg }: { msg: ChatMsg }): React.JSX.Element {
  const t = useTheme()
  const isUser = msg.role === 'user'
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        padding: t.spacing.s3,
        borderRadius: t.radius.card,
        backgroundColor: isUser ? t.color.accent : t.color.surface,
        borderWidth: isUser ? 0 : 1,
        // Assistant bubbles carry the accent AI-signature border (the product's
        // grounded-answer marker); user bubbles read as the accent fill.
        borderColor: t.color.accent,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: t.fontSize.sm,
          lineHeight: 20,
          color: isUser ? t.color.accentInk : t.color.ink,
        }}
      >
        {msg.text}
      </Text>
      {!isUser && !msg.refusal && (
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
          {msg.source === 'ai-proposal'
            ? 'KI-Formulierung · Zahlen aus deinen Daten, nie aus dem Modell'
            : 'Aus deinen Daten · deterministisch'}
        </Text>
      )}
    </View>
  )
}
