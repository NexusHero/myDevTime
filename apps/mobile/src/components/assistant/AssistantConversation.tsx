import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../core/Text'
import { Button, EmptyState, Input } from '../index'
import { useTheme } from '../../theme/ThemeProvider'
import { apiBaseUrl } from '../../config'
import { useReports } from '../../hooks/useReports'
import { askAssistant, factsFromReports, type AssistantResult } from '../../api/assistant'

/**
 * The Assistant conversation — the grounded, read-only chat body (ux-vision §2.4,
 * #20, M2), shared by the full-screen route and the shell overlay (ADR-0063). It
 * answers only from the workspace's own data: the client derives factual sentences
 * from the loaded Reports deterministically and sends them with the question; the
 * LLM phrases them, never invents a number, and refuses cleanly when the answer is
 * not in the facts (ADR-0005/0029). It proposes and never mutates state. One credit
 * per AI answer. Without a backend it falls back to a deterministic best-matching
 * fact. The host supplies the header (title / close); this owns the messages + input.
 */
export interface ChatMsg {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly refusal?: boolean
  readonly source?: 'deterministic' | 'ai-proposal'
}

const EXAMPLES: readonly string[] = [
  'What is my top project this week?',
  'What is my overtime balance?',
  'How much did I bill this week?',
]

/** Deterministic offline answer: pick the fact with the most word-overlap. */
export function offlineAnswer(question: string, facts: readonly string[]): AssistantResult {
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
        text: "That's not in your current data — ask more specifically.",
      }
}

export function AssistantConversation(): React.JSX.Element {
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
          text: `Couldn't answer — ${cause instanceof Error ? cause.message : String(cause)}`,
        })
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
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
            title="Ask your own data"
            hint="The Assistant answers only from your time, projects, budgets, and meetings — every number comes from deterministic aggregation, never from the model. 1 credit per question."
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
              placeholder="Ask about time, budgets, meetings … · 1 credit"
              value={input}
              onChangeText={setInput}
            />
          </View>
          <Button onPress={() => send(input)}>Send</Button>
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
        borderWidth: isUser ? 0 : t.borderWidth.medium,
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
        <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
          {msg.source === 'ai-proposal'
            ? 'AI phrasing · numbers from your data, never from the model'
            : 'From your data · deterministic'}
        </Text>
      )}
    </View>
  )
}
