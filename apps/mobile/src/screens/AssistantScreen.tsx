import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Badge, Button, EmptyState, Icon, Input } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Assistant — the grounded, read-only helper (ux-vision §2.4, #20). It answers
 * only from the workspace's own data through deterministic query tools; every
 * figure it shows comes from the aggregation, never the model (ADR-0005). It
 * proposes and deep-links, it never mutates state, and it refuses cleanly when a
 * question falls outside the data. One credit per question.
 */
interface ChatMsg {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly refusal?: boolean
}

/**
 * Scripted example answers for the preview. In the product these come from the
 * deterministic query tools — the assistant only reads, never writes (ADR-0005).
 */
const SCRIPTED: Readonly<Record<string, string>> = {
  'Wo bin ich über Budget?':
    'Finanzo liegt bei 92% des 40h-Monatsbudgets (36,8h gebucht) — das einzige Projekt über 80%. Huber CMS steht bei 54%, alles andere unter der Hälfte.',
  'Entwirf mein Standup':
    'Gestern: 6,4h auf Finanzo-Auth (2,5h), Konflikt-Tests (1,5h) und Reviews. Heute: Sprint-Review um 14:00 und die Tombstone-Story. Keine Blocker gemeldet.',
}

const EXAMPLES: readonly string[] = Object.keys(SCRIPTED)

export function AssistantScreen(): React.JSX.Element {
  const t = useTheme()
  const [msgs, setMsgs] = useState<readonly ChatMsg[]>([])
  const [input, setInput] = useState('')

  const send = (text: string): void => {
    if (!text.trim()) return
    const answer =
      SCRIPTED[text] ??
      'In dieser Preview beantworte ich die Beispielfragen. Im Produkt beantwortet der Assistant jede Frage zu deinen Zeiten, Projekten, Budgets und Meetings über deterministische Query-Tools — 1 Credit pro Frage.'
    setMsgs(m => [...m, { role: 'user', text }, { role: 'assistant', text: answer }])
    setInput('')
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
          Zahlen aus der deterministischen Aggregation · nie aus dem Modell
        </Text>
      )}
    </View>
  )
}
